import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { basicAuth } from "hono/basic-auth"
import { cors } from "hono/cors"
import mongoose from "mongoose"
import gameRoutes from "./Game/GameMain"
import rankingRoutes from "./Ranking/RankingMain"
import visitorRoutes from "./Visitor/VisitorMain"
import sessionRoutes from "./Session/SessionMain"
import adminRoutes from "./Admin/AdminMain"
import { errorResponse, successResponse } from "./http"

const requiredEnvironmentValue = (name: "DB_KEY" | "AUTH_NAME" | "AUTH_PASSWORD") => {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}

const start = async () => {
    const databaseUrl = requiredEnvironmentValue("DB_KEY")
    const authUser = requiredEnvironmentValue("AUTH_NAME")
    const authPassword = requiredEnvironmentValue("AUTH_PASSWORD")
    const port = Number(process.env.PORT ?? 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT: ${process.env.PORT}`)
    }

    await mongoose.connect(databaseUrl)
    console.log("Connected to MongoDB")

    const app = new Hono()
    app.get("/health", (c) => successResponse(c, { status: "ok" }))
    app.use("*", cors())
    app.use("*", basicAuth({ username: authUser, password: authPassword }))
    app.onError((error, c) => {
        console.error("Unhandled request error", error)
        return errorResponse(c, 500, "INTERNAL_ERROR", "unexpected server error")
    })
    app.notFound((c) => errorResponse(c, 404, "NOT_FOUND", "route not found"))

    app.route("/ranking", rankingRoutes)
    app.route("/game", gameRoutes)
    app.route("/visitor", visitorRoutes)
    app.route("/session", sessionRoutes)
    app.route("/admin", adminRoutes)
    app.get("/", (c) => successResponse(c, { service: "GCC Launcher API", year: 2026 }))

    const server = serve({ fetch: app.fetch, port })
    server.on("listening", () => {
        console.log(`GCC Launcher API listening on port ${port}`)
    })
    server.on("error", (error) => {
        console.error(`API server could not listen on port ${port}`, error)
        process.exitCode = 1
    })
}

start().catch((error) => {
    console.error("API server failed to start", error)
    process.exitCode = 1
})
