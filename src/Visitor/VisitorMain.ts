import { Hono } from "hono"
import Counter from "../models/Counter"
import { errorResponse, isNonEmptyString, parseJson, successResponse } from "../http"

const app = new Hono()

app.post("/create-visitor-data", async (c) => {
    const body = await parseJson<{ title: string }>(c)
    if (!body || !isNonEmptyString(body.title)) {
        return errorResponse(c, 400, "BAD_REQUEST", "title is required")
    }

    try {
        const counter = await Counter.create({ title: body.title.trim(), counter: 0 })
        return successResponse(c, counter, 201)
    } catch (error: any) {
        if (error?.code === 11000) {
            return errorResponse(c, 409, "CONFLICT", `visitor counter already exists: ${body.title}`)
        }
        console.error("Failed to create visitor counter", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to create visitor counter")
    }
})

app.post("/get-visitor", async (c) => {
    const body = await parseJson<{ title: string }>(c)
    if (!body || !isNonEmptyString(body.title)) {
        return errorResponse(c, 400, "BAD_REQUEST", "title is required")
    }

    try {
        const visitor = await Counter.findOne({ title: body.title.trim() }).lean()
        if (!visitor) {
            return errorResponse(c, 404, "NOT_FOUND", `visitor counter not found: ${body.title}`)
        }
        return successResponse(c, visitor)
    } catch (error) {
        console.error("Failed to load visitor counter", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to load visitor counter")
    }
})

app.put("/add-visitor", async (c) => {
    const body = await parseJson<{ title: string, add: number }>(c)
    if (!body || !isNonEmptyString(body.title) || !Number.isInteger(body.add) || body.add <= 0) {
        return errorResponse(c, 400, "BAD_REQUEST", "title and a positive integer add value are required")
    }

    try {
        const visitor = await Counter.findOneAndUpdate(
            { title: body.title.trim() },
            { $inc: { counter: body.add } },
            { new: true }
        ).lean()
        if (!visitor) {
            return errorResponse(c, 404, "NOT_FOUND", `visitor counter not found: ${body.title}`)
        }
        return successResponse(c, { title: visitor.title, counter: visitor.counter })
    } catch (error) {
        console.error("Failed to increment visitor counter", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "failed to increment visitor counter")
    }
})

export default app
