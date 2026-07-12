import mongoose, { Schema, Document } from "mongoose";

export interface IHierarchy extends Document {
  Name: string;
  tag_Name: string;
  parents: Array<{ "p-name": string; "p-id": mongoose.Types.ObjectId }>;
  children: Array<{ "p-name": string; "p-id": mongoose.Types.ObjectId }>;
  files: mongoose.Types.ObjectId[];
}

const HierarchySchema = new Schema<IHierarchy>({
  Name: { type: String, required: true },
  tag_Name: { type: String, required: true, unique: true },
  parents: [
    {
      "p-name": { type: String, required: true },
      "p-id": { type: Schema.Types.ObjectId, ref: "Hierarchy", required: true }
    }
  ],
  children: [
    {
      "p-name": { type: String, required: true },
      "p-id": { type: Schema.Types.ObjectId, ref: "Hierarchy", required: true }
    }
  ],
  files: {
    type: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    default: []
  }
});

// Forces the collection name to be "hierarchy" exactly
export const HierarchyModel =
  mongoose.models.Hierarchy ||
  mongoose.model<IHierarchy>("Hierarchy", HierarchySchema, "hierarchy");
