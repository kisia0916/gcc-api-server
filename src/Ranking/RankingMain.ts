import { Hono } from "hono";
import LauncherGame from "../models/LauncherGame";

const app = new Hono()

app.get("/get-all-ranking",async(c)=>{
    try{
        const rankingData = await LauncherGame.find().sort({counter:-1}).limit(15)
        return c.json({data:rankingData},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})
app.post("/get-genre-ranking",async(c)=>{
    try{
        const bodyData = await c.req.json<{genres:string[]}>()
        const genreRankingList:any = await Promise.all(bodyData.genres.map(async(i:string,index:number)=>{
            const genreRanking = await LauncherGame.find({genre:i}).sort({counter:-1}).limit(3)
            return genreRanking
        }))
        return c.json({data:genreRankingList})
    }catch(error){
        console.log(error)
        return c.json({message:"server error"},500)
    }
})

export default app