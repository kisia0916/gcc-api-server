import mongoose,{Schema}  from "mongoose";

export interface CounterInterface {
    title:string,
    counter:number
}
export interface CounterInterfaceMain extends CounterInterface{
    __v:number,
    _id:any
}

const dbSchema:Schema = new Schema({
    title:{
        type:String,
        required:true,
        unique:true
    },
    counter:{
        type:Number,
        default:0
    },
})

export default mongoose.model<CounterInterfaceMain>("Counter",dbSchema)