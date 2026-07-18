import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const nameQuery = searchParams.get("name");
    const tagsQuery = searchParams.get("tags");
    const idsQuery = searchParams.get("ids");

    // Parse searched tags for use in both filtering and hidden-tag matching
    let searchedTags: string[] = [];

    if (tagsQuery && tagsQuery.trim().length > 0) {
      searchedTags = tagsQuery
        .split("#")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
    }

    let rawDocs: any[];

    if (idsQuery && idsQuery.trim().length > 0) {
      const ids = idsQuery
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      rawDocs = ids.length
        ? await DocumentModel.find({ _id: { $in: ids } })
            .lean()
            .sort({ createdAt: -1 })
        : [];
    } else {
      const conditions: any[] = [];

      if (nameQuery && nameQuery.trim().length > 0) {
        conditions.push({ name: { $regex: nameQuery.trim(), $options: "i" } });
      }

      if (searchedTags.length > 0) {
        conditions.push({ tags: { $all: searchedTags } });
      }

      if (conditions.length === 0) {
        rawDocs = await DocumentModel.find({})
          .lean()
          .sort({ createdAt: -1 })
          .limit(20);
      } else {
        rawDocs = await DocumentModel.find({ $or: conditions })
          .lean()
          .sort({ createdAt: -1 });
      }
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

