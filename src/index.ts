import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import dotenv from "dotenv"
dotenv.config()
import mongoose from 'mongoose'
import { prettyJSON } from 'hono/pretty-json'

import gameRouter from "./Game/GameMain"
import visitorRouter from "./Visitor/VisitorMain"
import rankingRouter from "./Ranking/RankingMain"
import { basicAuth } from 'hono/basic-auth'
import { cors } from 'hono/cors'

const app = new Hono()
const DB_KEY = process.env.DB_KEY as string
const AUTH_NAME = process.env.AUTH_NAME as string
const AUTH_PASSWORD = process.env.AUTH_PASSWORD as string

mongoose.connect(DB_KEY).then(()=>{
  console.log("connected DB!")
})

app.use(prettyJSON())
app.use("*",cors())
app.use("*",basicAuth({
  username:AUTH_NAME,
  password:AUTH_PASSWORD
}))
app.notFound((c)=>c.json({message:"not found"},404))

app.route("/game",gameRouter)
app.route("/visitor",visitorRouter)
app.route("/ranking",rankingRouter)

app.get('/', (c) => {
  return c.text("test")
})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
