import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const nameQuery = searchParams.get("name");
    const tagsQuery = searchParams.get("tags");

    const conditions: any[] = [];

    if (nameQuery && nameQuery.trim().length > 0) {
      conditions.push({ name: { $regex: nameQuery.trim(), $options: "i" } });
    }

    if (tagsQuery && tagsQuery.trim().length > 0) {
      const searchedTags = tagsQuery
        .split("#")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);

      if (searchedTags.length > 0) {
        conditions.push({ tags: { $all: searchedTags } });
      }
    }

    // If no search query is provided, return all documents.
    // Otherwise, perform an OR query matching name OR tags.
    const query = conditions.length > 0 ? { $or: conditions } : {};
    console.log(query);
    console.log(conditions);

    const documents = await DocumentModel.find(query)
      .select("-password") // Do not expose the password
      .sort({ createdAt: -1 });

    return NextResponse.json(documents, { status: 200 });
  } catch (error: any) {
    console.error("Search Error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching documents." },
      { status: 500 }
    );
  }
}
