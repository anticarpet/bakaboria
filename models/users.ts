import mongoose, { Schema, Document } from "mongoose";

export interface Iuser extends Document {
    uid: string;
    username: string;
    email: string;
    password?: string;      // optional — OAuth users have no password
    image?: string;         // profile picture from Google
    role: string;
    createdAt: Date;
}

const userSchema = new Schema<Iuser>({
    uid: { type: String },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },           // not required for OAuth
    image: { type: String },
    role: { type: String, default: "user" },
    createdAt: { type: Date, default: Date.now },
});

// Use existing model if already compiled, or compile new one
export const userModel =
    mongoose.models.user || mongoose.model<Iuser>("user", userSchema);
