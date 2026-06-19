import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import fs from "fs";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";

// Extract Google Drive file ID from any common Drive URL
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

    const { id, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    const doc = await DocumentModel.findById(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // Verify password
    const storedPassword = doc.password || "";
    const inputPassword = password || "";

    if (storedPassword !== inputPassword) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    }

    const downloadName = doc.name.toLowerCase().endsWith(".pdf")
      ? doc.name
      : `${doc.name}.pdf`;

    // ── DRIVE download (proxy) ────────────────────────────────────────────────
    if (doc.storeMethod === "DRIVE") {
      const fileId = extractDriveId(doc.fileLocation);

      if (!fileId) {
        return NextResponse.json(
          { error: "Could not resolve the Google Drive file ID." },
          { status: 500 }
        );
      }

      // Use the usercontent endpoint with confirm=t to bypass the virus-scan page
      const driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;

      const driveRes = await fetch(driveDownloadUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      });

      if (!driveRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch the file from Google Drive." },
          { status: 502 }
        );
      }

      return new Response(driveRes.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
      });
    }

    // ── PDF (local) download ──────────────────────────────────────────────────
    const absolutePath = path.join(process.cwd(), doc.fileLocation);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: "Document file not found on disk." },
        { status: 404 }
      );
    }

    const originalExtension = path.extname(doc.fileName);
    let localDownloadName = doc.name;
    if (
      originalExtension &&
      !localDownloadName.toLowerCase().endsWith(originalExtension.toLowerCase())
    ) {
      localDownloadName = `${localDownloadName}${originalExtension}`;
    }

    const fileBuffer = await readFile(absolutePath);
    const fileStat = await stat(absolutePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(localDownloadName)}"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
      },
    });
  } catch (error: any) {
    console.error("Download Error:", error);
    return NextResponse.json(
      { error: "An error occurred while downloading the document." },
      { status: 500 }
    );
  }
}
