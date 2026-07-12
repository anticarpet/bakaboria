import mongoose, { Schema } from "mongoose";

export interface IGeminiResult {
  _id: string;
  result: Record<string, any>;
  createdAt: Date;
}

const GeminiResultSchema = new Schema<IGeminiResult>({
  _id: { type: String, required: true },
  result: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Use existing model if already compiled, or compile new one
export const GeminiResultModel =
  mongoose.models.GeminiResult ||
  mongoose.model<IGeminiResult>("GeminiResult", GeminiResultSchema);
