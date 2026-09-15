import mongoose, { Schema } from "mongoose"

export interface SessionSettingsInterface {
    key: string
    durationSeconds: number
}

const sessionSettingsSchema = new Schema<SessionSettingsInterface>({
    key: {
        type: String,
        required: true,
        unique: true
    },
    durationSeconds: {
        type: Number,
        required: true,
        min: 30,
        max: 3600
    }
}, { timestamps: true })

export default mongoose.model<SessionSettingsInterface>("SessionSettings", sessionSettingsSchema)
