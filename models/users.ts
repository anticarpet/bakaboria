import mongoose, { Schema, Document, Types } from "mongoose";

export interface Iuser extends Document {
    uid: string;
    username: string;
    email: string;
    password?: string;      // optional — OAuth users have no password
    image?: string;         // profile picture from Google
    role: string;
    points: number;
    assignedTasks: Types.ObjectId[];
    createdAt: Date;
}

const userSchema = new Schema<Iuser>({
    uid: { type: String },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },           // not required for OAuth
    image: { type: String },
    role: { type: String, default: "user" },
    points: { type: Number, default: 0 },
    assignedTasks: [{ type: Schema.Types.ObjectId, ref: "task" }],
    createdAt: { type: Date, default: Date.now },
});

// Use existing model if already compiled, or compile new one
export const userModel =
    mongoose.models.user || mongoose.model<Iuser>("user", userSchema);
