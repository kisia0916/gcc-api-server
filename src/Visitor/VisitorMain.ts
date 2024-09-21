import { Hono } from "hono";
import Counter from "../models/Counter";

const app = new Hono()

app.post("/create-visitor-data",async(c)=>{
    try{
        const bodyData = await c.req.json<{title:string}>()
        const newData = new Counter({
            title:bodyData.title,
        })
        newData.save()
        return c.json({data:newData},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})
app.delete("/delete",async(c)=>{
    try{
        await Counter.deleteOne({title:"main"})
        return c.json({data:"done"},200)
    }catch{}
})
app.post("/get-visitor",async(c)=>{
    try{
        const bodyData = await c.req.json<{title:string}>()
        const visitor = await Counter.findOne({title:bodyData.title})
        return c.json({data:visitor},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})
app.put("/add-visitor",async(c)=>{
    try{
        const bodyData = await c.req.json<{title:string,add:number}>()
        await Counter.updateOne({title:bodyData.title},{$inc:{counter:bodyData.add}})
        return c.json({data:"done"},200)
    }catch{
        return c.json({message:"server error"},500)
    }
})

export default app