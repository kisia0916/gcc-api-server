import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import LauncherGame from "./models/LauncherGame"
import { isNonEmptyString } from "./http"

type GameInput = { title: string, genre: string }

export type CatalogSyncResult = {
    total: number
    inserted: number
    existing: number
}

export class CatalogValidationError extends Error {
    constructor(public readonly details: Record<string, unknown>) {
        super("catalog validation failed")
        this.name = "CatalogValidationError"
    }
}

const validateGame = (value: unknown): value is GameInput => {
    if (!value || typeof value !== "object") return false
    const game = value as Record<string, unknown>
    return isNonEmptyString(game.title) && isNonEmptyString(game.genre)
}

export const resolveGameCatalogPath = () => path.resolve(
    process.env.GAME_CATALOG_PATH ?? path.join(process.cwd(), "docker", "game_info.json")
)

export const loadGameCatalog = (catalogPath = resolveGameCatalogPath()): GameInput[] => {
    if (!fs.existsSync(catalogPath)) {
        throw new Error(`game catalog was not found: ${catalogPath}`)
    }

    const gameInfo = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as Record<string, unknown>
    const genres = Array.isArray(gameInfo.genres)
        ? gameInfo.genres.filter(isNonEmptyString)
        : []
    if (genres.length === 0) {
        throw new CatalogValidationError({ invalidEntries: ["catalog has no genres"] })
    }

    const games: GameInput[] = []
    const invalidEntries: string[] = []
    for (const genre of genres) {
        const entries = gameInfo[genre]
        if (!Array.isArray(entries)) {
            invalidEntries.push(`${genre}: game list is missing`)
            continue
        }
        entries.forEach((entry, index) => {
            if (!validateGame(entry)) {
                invalidEntries.push(`${genre}[${index}]: title or genre is invalid`)
                return
            }
            games.push({ title: entry.title.trim(), genre: entry.genre.trim() })
        })
    }

    const duplicateTitles = games
        .map((game) => game.title)
        .filter((title, index, titles) => titles.indexOf(title) !== index)
    if (games.length === 0) invalidEntries.push("catalog has no games")
    if (invalidEntries.length > 0 || duplicateTitles.length > 0) {
        throw new CatalogValidationError({
            invalidEntries,
            duplicateTitles: [...new Set(duplicateTitles)]
        })
    }

    return games
}

export const syncGameCatalog = async (
    catalogPath = resolveGameCatalogPath()
): Promise<CatalogSyncResult> => {
    const games = loadGameCatalog(catalogPath)
    const insertedAt = new Date()
    const result = await LauncherGame.bulkWrite(games.map((game) => ({
        updateOne: {
            filter: { title: game.title },
            update: {
                $setOnInsert: {
                    id: randomUUID(),
                    title: game.title,
                    genre: game.genre,
                    counter: 0,
                    createdAt: insertedAt,
                    updatedAt: insertedAt
                }
            },
            upsert: true,
            timestamps: false
        }
    })), { ordered: false })

    return {
        total: games.length,
        inserted: result.upsertedCount,
        existing: result.matchedCount
    }
}
