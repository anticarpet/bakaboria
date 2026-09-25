import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITask extends Document {
    name: string;
    description: string;
    author: Types.ObjectId;       // User who created the task
    assignedTo?: Types.ObjectId;  // User currently assigned (who picked it up)
    dueDate: Date;
    points: number;
    status: "pending" | "assigned" | "completed" | "missed";
    createdAt: Date;
}

const taskSchema = new Schema<ITask>({
    name: { type: String, required: true },
    description: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "user", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "user", default: null },
    dueDate: { type: Date, required: true },
    points: { type: Number, required: true, min: 1 },
    status: {
        type: String,
        enum: ["pending", "assigned", "completed", "missed"],
        default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
});

export const TaskModel =
    mongoose.models.task || mongoose.model<ITask>("task", taskSchema);
