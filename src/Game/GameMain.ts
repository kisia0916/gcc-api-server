import { Hono } from "hono";
import LauncherGame, { gameInterfaceMain } from "../models/LauncherGame";
import fs from "fs"
import { basicAuth } from "hono/basic-auth";
const {v4:uuidv4} = require("uuid")
const app = new Hono()

app.post("/set-new-game",async(c)=>{
    try{
        const game = await c.req.json<gameInterfaceMain>()
        const newGame = new LauncherGame({
            id:uuidv4(),
            title:game.title,
            genre:game.genre
        })
        newGame.save()
        return c.json({data:newGame},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})

app.post("/set-all-game",async(c)=>{
    try{
        const game_info = JSON.parse(fs.readFileSync(`${process.cwd()}/game_info.json`,"utf-8") as string)
        console.log(game_info)
        Object.entries(game_info).forEach(([key,value]:[string,any])=>{
            if (key !== 'genres'){
                value.forEach((i:any)=>{
                    const newData = new LauncherGame({
                        id:uuidv4(),
                        title:i.title,
                        genre:i.genre
                    })
                    newData.save()
                })
            }
        })
        return c.json({data:"done"},200)
    }catch(error){
        console.log(error)
        return c.json({message:"server error"},500)
    }
})

app.post("/get-all-view-counter",async(c)=>{
    try{
        const bodyData:{genres:string[]} = await c.req.json<{genres:string[]}>()
        const resViewList = await Promise.all(bodyData.genres.map(async(i)=>{
            const genreGame = await LauncherGame.find({genre:i as string})
            const viewData = genreGame.map((k:gameInterfaceMain)=>{
                return {title:k.title,counter:k.counter}
            })
            return viewData
        }))
        return c.json({data:resViewList},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})
app.put("/add-view-counter",async(c)=>{
    try{
        const bodyData = await c.req.json<{title:string}>()
        await LauncherGame.updateOne({title:bodyData.title},{$inc:{counter:1}})
        return c.json({message:"done"},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})

export default app