import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import LauncherGame from "../models/LauncherGame"
import { errorResponse, isNonEmptyString, parseJson, successResponse } from "../http"
import { CatalogValidationError, syncGameCatalog } from "../catalog"

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
        return successResponse(c, await syncGameCatalog())
    } catch (error) {
        if (error instanceof CatalogValidationError) {
            return errorResponse(c, 400, "BAD_REQUEST", error.message, error.details)
        }
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
