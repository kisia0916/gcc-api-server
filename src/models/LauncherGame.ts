import mongoose,{Schema} from "mongoose";

export interface gameInterface  {
    id:string,
    title:string,
    counter:number,
    genre:string,
}
export interface gameInterfaceMain extends gameInterface{
    __v:number,
    _id:any
}

const dbSchema:Schema = new Schema({
    id:{
        type:String,
        required:true
    },
    title:{
        type:String,
        required:true,
        unique:true
    },
    counter:{
        type:Number,
        default:0
    },
    genre:{
        type:String,
        required:true,
    }
})

export default mongoose.model<gameInterfaceMain>("LauncherGame",dbSchema)