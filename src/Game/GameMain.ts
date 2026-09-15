import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import LauncherGame from "../models/LauncherGame"
import { errorResponse, isNonEmptyString, parseJson, successResponse } from "../http"

const app = new Hono()

type GameInput = { title: string, genre: string }

const validateGame = (value: unknown): value is GameInput => {
    if (!value || typeof value !== "object") return false
    const game = value as Record<string, unknown>
    return isNonEmptyString(game.title) && isNonEmptyString(game.genre)
}

app.post("/set-new-game", async (c) => {
    const game = await parseJson<GameInput>(c)
    if (!validateGame(game)) {
        return errorResponse(c, 400, "BAD_REQUEST", "title and genre are required")
    }

    try {
        const newGame = await LauncherGame.create({
            id: randomUUID(),
            title: game.title.trim(),
            genre: game.genre.trim(),
            counter: 0
        })
        return successResponse(c, newGame, 201)
    } catch (error: any) {
        if (error?.code === 11000) {
            return errorResponse(c, 409, "CONFLICT", `game already exists: ${game.title}`)
        }
        console.error("Failed to create game", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to create game")
    }
})

app.post("/set-all-game", async (c) => {
    try {
        const catalogPath = path.resolve(process.cwd(), "game_info.json")
        if (!fs.existsSync(catalogPath)) {
            return errorResponse(c, 500, "INTERNAL_ERROR", "game_info.json was not found")
        }

        const gameInfo = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as Record<string, unknown>
        const genres = Array.isArray(gameInfo.genres)
            ? gameInfo.genres.filter(isNonEmptyString)
            : []
        if (genres.length === 0) {
            return errorResponse(c, 400, "BAD_REQUEST", "catalog has no genres")
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
        if (invalidEntries.length > 0 || duplicateTitles.length > 0) {
            return errorResponse(c, 400, "BAD_REQUEST", "catalog validation failed", {
                invalidEntries,
                duplicateTitles: [...new Set(duplicateTitles)]
            })
        }
        if (games.length === 0) {
            return errorResponse(c, 400, "BAD_REQUEST", "catalog has no games")
        }

        const result = await LauncherGame.bulkWrite(games.map((game) => ({
            updateOne: {
                filter: { title: game.title },
                update: {
                    $set: { genre: game.genre },
                    $setOnInsert: { id: randomUUID(), counter: 0 }
                },
                upsert: true
            }
        })), { ordered: false })

        return successResponse(c, {
            total: games.length,
            inserted: result.upsertedCount,
            updated: result.modifiedCount,
            matched: result.matchedCount
        })
    } catch (error) {
        console.error("Failed to synchronize game catalog", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to synchronize game catalog")
    }
})

app.post("/get-all-view-counter", async (c) => {
    const body = await parseJson<{ genres: string[] }>(c)
    if (!body || !Array.isArray(body.genres) || !body.genres.every(isNonEmptyString)) {
        return errorResponse(c, 400, "BAD_REQUEST", "genres must be an array of strings")
    }

    try {
        const viewList = await Promise.all(body.genres.map(async (genre) => {
            const games = await LauncherGame.find({ genre }).lean()
            return games.map((game) => ({ title: game.title, counter: game.counter }))
        }))
        return successResponse(c, viewList)
    } catch (error) {
        console.error("Failed to load view counters", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load view counters")
    }
})

app.put("/add-view-counter", async (c) => {
    const body = await parseJson<{ title: string }>(c)
    if (!body || !isNonEmptyString(body.title)) {
        return errorResponse(c, 400, "BAD_REQUEST", "title is required")
    }

    try {
        const game = await LauncherGame.findOneAndUpdate(
            { title: body.title.trim() },
            { $inc: { counter: 1 } },
            { new: true }
        ).lean()
        if (!game) {
            return errorResponse(c, 404, "NOT_FOUND", `game not found: ${body.title}`)
        }
        return successResponse(c, { title: game.title, counter: game.counter })
    } catch (error) {
        console.error("Failed to increment view counter", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to increment view counter")
    }
})

app.put("/reset-all-view-counter", async (c) => {
    try {
        const result = await LauncherGame.updateMany({}, { $set: { counter: 0 } })
        return successResponse(c, { matched: result.matchedCount, modified: result.modifiedCount })
    } catch (error) {
        console.error("Failed to reset view counters", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to reset view counters")
    }
})

export default app
