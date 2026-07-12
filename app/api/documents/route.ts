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

    // Parse searched tags for use in both filtering and hidden-tag matching
    let searchedTags: string[] = [];

    if (nameQuery && nameQuery.trim().length > 0) {
      conditions.push({ name: { $regex: nameQuery.trim(), $options: "i" } });
    }

    if (tagsQuery && tagsQuery.trim().length > 0) {
      searchedTags = tagsQuery
        .split("#")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);

      if (searchedTags.length > 0) {
        conditions.push({ tags: { $all: searchedTags } });
      }
    }

    let rawDocs: any[];

    if (conditions.length === 0) {
      // No filters: return the 20 most recent documents of any type
      rawDocs = await DocumentModel.find({})
        .lean()
        .sort({ createdAt: -1 })
        .limit(20);
    } else {
      rawDocs = await DocumentModel.find({ $or: conditions })
        .lean()
        .sort({ createdAt: -1 });
    }

    // Filter out hidden documents unless a searched tag matches a hiddenTag
    const visibleDocs = rawDocs.filter((doc) => {
      if (!doc.hidden) return true;

      // Hidden doc: only show if at least one searched tag is in hiddenTags
      if (searchedTags.length === 0) return false;
      const docHiddenTags = (doc.hiddenTags || []).map((t: string) => t.toLowerCase());
      return searchedTags.some((st) => docHiddenTags.includes(st));
    });

    // Strip password but expose hasPassword flag and new fields
    const documents = visibleDocs.map(({ password, ...rest }) => ({
      ...rest,
      hasPassword: !!password,
    }));

    return NextResponse.json(documents, { status: 200 });
  } catch (error: any) {
    console.error("Search Error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching documents." },
      { status: 500 }
    );
  }
}

