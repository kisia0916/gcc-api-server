import { Hono } from "hono"
import Counter from "../models/Counter"
import LauncherGame from "../models/LauncherGame"
import SessionSettings from "../models/SessionSettings"
import { errorResponse, successResponse } from "../http"

const app = new Hono()
const SETTINGS_KEY = "main"
const VISITOR_COUNTER_KEY = "main"
const DEFAULT_DURATION_SECONDS = 360

app.get("/dashboard", async (c) => {
    try {
        const [settings, visitor, games] = await Promise.all([
            SessionSettings.findOneAndUpdate(
                { key: SETTINGS_KEY },
                { $setOnInsert: { durationSeconds: DEFAULT_DURATION_SECONDS } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            ).lean(),
            Counter.findOneAndUpdate(
                { title: VISITOR_COUNTER_KEY },
                { $setOnInsert: { counter: 0 } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            ).lean(),
            LauncherGame.find().sort({ counter: -1, title: 1 }).lean()
        ])

        const ranking = games.map((game) => ({
            title: game.title,
            genre: game.genre,
            counter: game.counter
        }))

        return successResponse(c, {
            generatedAt: new Date().toISOString(),
            durationSeconds: settings.durationSeconds,
            visitors: visitor.counter,
            totalGames: ranking.length,
            totalPlays: ranking.reduce((sum, game) => sum + game.counter, 0),
            ranking
        })
    } catch (error) {
        console.error("Failed to load admin dashboard", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load admin dashboard")
    }
})

export default app
