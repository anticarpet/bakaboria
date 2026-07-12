import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";

/**
 * One-shot migration endpoint.
 * Sets default values for the new fields on all existing documents
 * that don't already have them.
 *
 * POST /api/migrate-documents
 */
export async function POST() {
  try {
    await connectDB();

    const result = await DocumentModel.updateMany(
      {},
      {
        $setOnInsert: {},
        $set: {},
      }
    );

    // Use $set with a condition: only set fields that are missing
    const bulkResult = await DocumentModel.updateMany(
      {
        $or: [
          { primaryTags: { $exists: false } },
          { propertyTags: { $exists: false } },
          { hidden: { $exists: false } },
          { hiddenTags: { $exists: false } },
          { processed: { $exists: false } },
          { reviewed: { $exists: false } },
        ],
      },
      {
        $set: {
          primaryTags: [],
          propertyTags: [],
          hidden: false,
          hiddenTags: [],
          processed: false,
          reviewed: false,
        },
      }
    );

    return NextResponse.json(
      {
        message: "Migration complete.",
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Migration Error:", error);
    return NextResponse.json(
      { error: "Migration failed: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}
