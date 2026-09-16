import { Hono } from "hono"
import LauncherGame from "../models/LauncherGame"
import { errorResponse, isNonEmptyString, parseJson, successResponse } from "../http"

const app = new Hono()

app.get("/get-all-ranking", async (c) => {
    try {
        const ranking = await LauncherGame.find().sort({ counter: -1 }).limit(15).lean()
        return successResponse(c, ranking)
    } catch (error) {
        console.error("Failed to load ranking", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load ranking")
    }
})

app.post("/get-genre-ranking", async (c) => {
    const body = await parseJson<{ genres: string[] }>(c)
    if (!body || !Array.isArray(body.genres) || !body.genres.every(isNonEmptyString)) {
        return errorResponse(c, 400, "BAD_REQUEST", "genres must be an array of strings")
    }

    try {
        const rankings = await Promise.all(body.genres.map((genre) =>
            LauncherGame.find({ genre }).sort({ counter: -1 }).limit(3).lean()
        ))
        return successResponse(c, rankings)
    } catch (error) {
        console.error("Failed to load genre ranking", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load genre ranking")
    }
})

export default app
