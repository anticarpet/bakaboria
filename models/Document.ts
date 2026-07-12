import mongoose, { Schema, Document } from "mongoose";

export interface IDocument extends Document {
  uid: string;
  name: string;
  password?: string;
  tags: string[];
  primaryTags: string[];
  propertyTags: string[];
  hidden: boolean;
  hiddenTags: string[];
  processed: boolean;
  reviewed: boolean;
  fileLocation: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  verified: boolean;
  storeMethod: "PDF" | "DRIVE";
  caste: mongoose.Types.ObjectId[];
}

const DocumentSchema = new Schema<IDocument>({
  uid: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, default: "" },
  tags: { type: [String], default: [] },
  primaryTags: { type: [String], default: [] },
  propertyTags: { type: [String], default: [] },
  hidden: { type: Boolean, default: false },
  hiddenTags: { type: [String], default: [] },
  processed: { type: Boolean, default: false },
  reviewed: { type: Boolean, default: false },
  fileLocation: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  storeMethod: { type: String, enum: ["PDF", "DRIVE"], default: "PDF" },
  caste: {
    type: [{ type: Schema.Types.ObjectId, ref: "Hierarchy" }],
    default: []
  },
});

// Use existing model if already compiled, or compile new one
export const DocumentModel =
  mongoose.models.Document || mongoose.model<IDocument>("Document", DocumentSchema);
