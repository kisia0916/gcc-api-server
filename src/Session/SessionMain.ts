import { Hono } from "hono"
import SessionSettings from "../models/SessionSettings"
import { errorResponse, parseJson, successResponse } from "../http"

const app = new Hono()
const SETTINGS_KEY = "main"
const DEFAULT_DURATION_SECONDS = 360

app.get("/settings", async (c) => {
    try {
        const settings = await SessionSettings.findOneAndUpdate(
            { key: SETTINGS_KEY },
            { $setOnInsert: { durationSeconds: DEFAULT_DURATION_SECONDS } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean()
        return successResponse(c, {
            durationSeconds: settings.durationSeconds,
            updatedAt: (settings as any).updatedAt
        })
    } catch (error) {
        console.error("Failed to load session settings", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load session settings")
    }
})

app.put("/settings", async (c) => {
    const body = await parseJson<{ durationSeconds: number }>(c)
    if (
        !body
        || !Number.isInteger(body.durationSeconds)
        || body.durationSeconds < 30
        || body.durationSeconds > 3600
    ) {
        return errorResponse(
            c,
            400,
            "BAD_REQUEST",
            "durationSeconds must be an integer between 30 and 3600"
        )
    }

    try {
        const settings = await SessionSettings.findOneAndUpdate(
            { key: SETTINGS_KEY },
            { $set: { durationSeconds: body.durationSeconds } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean()
        return successResponse(c, {
            durationSeconds: settings.durationSeconds,
            updatedAt: (settings as any).updatedAt
        })
    } catch (error) {
        console.error("Failed to update session settings", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to update session settings")
    }
})

export default app
