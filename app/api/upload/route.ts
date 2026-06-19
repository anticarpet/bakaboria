import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";

// Extracts a Google Drive file ID from common share URL formats
function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/open\?id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();
    const uid = formData.get("uid") as string;
    const name = formData.get("name") as string;
    const password = (formData.get("password") as string) || "";
    const tagsInput = (formData.get("tags") as string) || "";
    const storeMethod = (formData.get("storeMethod") as string) || "PDF";

    if (!uid || !name) {
      return NextResponse.json(
        { error: "UID and Document Name are required." },
        { status: 400 }
      );
    }

    // Process Tags: e.g. "#physics #CUFE" -> ["physics", "cufe"]
    const parsedTags = tagsInput
      .split("#")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    // ── DRIVE upload ─────────────────────────────────────────────────────────
    if (storeMethod === "DRIVE") {
      const driveUrl = (formData.get("driveUrl") as string) || "";
      if (!driveUrl) {
        return NextResponse.json(
          { error: "A Google Drive URL is required for Drive uploads." },
          { status: 400 }
        );
      }

      const fileId = extractDriveId(driveUrl);
      if (!fileId) {
        return NextResponse.json(
          { error: "Could not extract a valid Google Drive file ID from the provided URL." },
          { status: 400 }
        );
      }

      // Normalise to a canonical share URL
      const canonicalUrl = `https://drive.google.com/file/d/${fileId}/view`;

      const newDoc = new DocumentModel({
        uid,
        name,
        password,
        tags: parsedTags,
        fileLocation: canonicalUrl,
        fileName: `${name}.pdf`,
        fileSize: 0,
        mimeType: "application/pdf",
        storeMethod: "DRIVE",
      });

      await newDoc.save();

      return NextResponse.json(
        {
          message: "Drive document registered successfully.",
          documentId: newDoc._id.toString(),
        },
        { status: 201 }
      );
    }

    // ── PDF (local) upload ────────────────────────────────────────────────────
    const documentFile = formData.get("document") as File | null;

    if (!documentFile) {
      return NextResponse.json(
        { error: "A PDF file is required." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await documentFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create docus directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "docus");
    await mkdir(uploadDir, { recursive: true });

    // Generate collision-free filename
    const fileExtension = path.extname(documentFile.name);
    const baseName = path.basename(documentFile.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
    const safeFileName = `${Date.now()}_${baseName}${fileExtension}`;
    const fileLocation = path.join(uploadDir, safeFileName);

    // Write file to disk
    await writeFile(fileLocation, buffer);

    const relativePath = path.join("docus", safeFileName);
    const newDoc = new DocumentModel({
      uid,
      name,
      password,
      tags: parsedTags,
      fileLocation: relativePath,
      fileName: documentFile.name,
      fileSize: documentFile.size,
      mimeType: documentFile.type || "application/octet-stream",
      storeMethod: "PDF",
    });

    await newDoc.save();

    return NextResponse.json(
      {
        message: "Document uploaded and registered successfully.",
        documentId: newDoc._id.toString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "An error occurred while uploading the document." },
      { status: 500 }
    );
  }
}
