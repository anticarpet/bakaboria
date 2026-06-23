"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

import Image from "next/image";

type UploadMode = "PDF" | "DRIVE";

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

function validateDriveUrl(url: string): string {
  if (!url.trim()) return "";
  if (!url.includes("drive.google.com")) return "Must be a Google Drive URL.";
  if (!extractDriveId(url)) return "Could not find a file ID in this URL. Share the file and paste the share link.";
  return ""; // valid
}



export default function UploadDocPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [uploadMode, setUploadMode] = useState<UploadMode>("DRIVE");
  const [isPdfHovered, setIsPdfHovered] = useState<boolean>(false);
  const [isDriveHovered, setIsDriveHovered] = useState(false);

  // Shared fields
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [parsedTags, setParsedTags] = useState<string[]>([]);

  // PDF-specific
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Drive-specific
  const [driveUrl, setDriveUrl] = useState("");
  const [driveUrlError, setDriveUrlError] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-fill uid from authenticated session
  useEffect(() => {
    if (session?.user && (session.user as any).id) {
      setUid((session.user as any).id);
    }
  }, [session]);

  // Live parse tags
  useEffect(() => {
    const tags = tagsInput
      .split("#")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setParsedTags(tags);
  }, [tagsInput]);

  // Validate drive URL live
  useEffect(() => {
    if (driveUrl) setDriveUrlError(validateDriveUrl(driveUrl));
    else setDriveUrlError("");
  }, [driveUrl]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const resetForm = () => {
    setUid("");
    setName("");
    setPassword("");
    setTagsInput("");
    setFile(null);
    setDriveUrl("");
    setDriveUrlError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!uid || !name) {
      setStatus({ type: "error", message: "Please fill in UID and Document Name." });
      return;
    }

    if (uploadMode === "PDF" && !file) {
      setStatus({ type: "error", message: "Please select a PDF file to upload." });
      return;
    }

    if (uploadMode === "DRIVE") {
      const err = validateDriveUrl(driveUrl);
      if (err) {
        setDriveUrlError(err);
        setStatus({ type: "error", message: "Fix the Drive URL error before submitting." });
        return;
      }
      if (!driveUrl.trim()) {
        setStatus({ type: "error", message: "Please enter a Google Drive URL." });
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("uid", uid);
      formData.append("name", name);
      formData.append("password", password);
      formData.append("tags", tagsInput);
      formData.append("storeMethod", uploadMode);

      if (uploadMode === "PDF" && file) {
        formData.append("document", file);
      } else if (uploadMode === "DRIVE") {
        formData.append("driveUrl", driveUrl);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: "success", message: data.message || "Document registered successfully!" });
        resetForm();
      } else {
        setStatus({ type: "error", message: data.error || "Failed to upload document." });
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };









  // Loading state while session is being fetched
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <svg className="animate-spin h-8 w-8 text-black" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">

      {/* ── Session header ── */}
      {session?.user && (
        <div className="w-full max-w-2xl flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={36}
                height={36}
                className="rounded-full border border-black/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white text-sm font-semibold">
                {session.user.name?.[0] ?? "U"}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-black leading-none">{session.user.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{session.user.email}</p>
            </div>
          </div>
          <button
            id="sign-out-btn"
            onClick={() => signOut({ callbackUrl: "/signIn" })}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-black border border-slate-200 hover:border-black rounded-lg px-3 py-1.5 transition-all"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}

      <div className="max-w-2xl w-full space-y-8 z-10">

        {/* Form Container */}
        <div className="bg-white border border-3 border-black rounded-xl p-8 sm:p-10 shadow-sm space-y-6">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black">
              Upload a Document
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* UID + Name */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="uid" className="block text-sm font-semibold text-black">
                  User ID (UID)
                  {session?.user && (
                    <span className="ml-2 text-xs font-normal text-emerald-600">✓ auto-filled</span>
                  )}
                </label>
                <input
                  type="text"
                  id="uid"
                  required
                  placeholder="e.g. 612983912391273"
                  value={uid}
                  readOnly={!!session?.user}
                  onChange={(e) => setUid(e.target.value)}
                  className={`mt-1.5 block w-full rounded-lg border px-4 py-2.5 text-black placeholder-slate-500 focus:outline-none focus:ring-2 transition-all text-sm ${
                    session?.user
                      ? "bg-slate-50 border-slate-300 text-slate-600 cursor-not-allowed focus:ring-0"
                      : "bg-white border-slate-800 focus:border-black focus:ring-black/10"
                  }`}
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-black">
                  Document Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  placeholder="e.g. Physics final 1st comm 2013"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-black">
                Document Password{" "}
                <span className="text-xs text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                id="password"
                placeholder="e.g. SajidE143"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
              />
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="block text-sm font-semibold text-black">
                Tags{" "}
                <span className="text-xs text-slate-500 font-normal">(Separated by hashtags)</span>
              </label>
              <input
                type="text"
                id="tags"
                placeholder="e.g. #2013 #difficult #physics #CUFE"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
              />
              {parsedTags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {parsedTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-black border border-black/20"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Upload Mode Toggle ── */}
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                Upload Method
              </label>
              <div className="flex rounded-lg border border-black overflow-hidden w-fit">
                <button
                  type="button"
                  
                  onClick={() => setUploadMode("DRIVE")}
                  onMouseEnter={() => setIsPdfHovered(true)}
                  onMouseLeave={() => setIsPdfHovered(false)}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                    uploadMode === "PDF"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-slate-100"
                  }`}
                > {isPdfHovered? "PDF ( temporarily disabled) " : "PDF" }
                  {/* Page icon */}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                 
                </button>
                <button
                  type="button"
                  
                  onClick={() => setUploadMode("DRIVE")}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold transition-all cursor-pointer border-l border-black ${
                    uploadMode === "DRIVE"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-slate-100"
                  }`}
                >
                  {/* Cloud icon */}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Drive
                </button>
              </div>
            </div>

            {/* ── PDF dropzone ── */}
            {uploadMode === "PDF" && (
              <div>
                <label className="block text-sm font-semibold text-black mb-1.5">
                  Upload File (PDF preferred)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragActive
                      ? "border-black bg-slate-50"
                      : file
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-400 hover:border-black bg-white"
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,application/pdf"
                  />
                  <label
                    htmlFor="file-upload"
                    className="w-full h-full flex flex-col items-center justify-center p-4 text-center cursor-pointer"
                  >
                    {file ? (
                      <div className="space-y-1">
                        <svg className="mx-auto h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-emerald-600 truncate max-w-xs sm:max-w-md">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm font-medium text-black">
                          Drag and drop your file here, or{" "}
                          <span className="font-semibold underline decoration-2 decoration-black/30">
                            browse
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">PDF documents up to 50MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* ── Drive URL input ── */}
            {uploadMode === "DRIVE" && (
              <div>
                <label htmlFor="driveUrl" className="block text-sm font-semibold text-black">
                  Google Drive Share URL
                </label>
                <p className="text-xs text-slate-500 mt-0.5 mb-1.5">
                  Share your PDF in Drive → "Anyone with the link can view" → paste the link here.
                </p>
                <div className="relative">
                  <input
                    type="url"
                    id="driveUrl"
                    placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    className={`mt-1 block w-full rounded-lg bg-white border px-4 py-2.5 text-black placeholder-slate-400 focus:outline-none focus:ring-2 transition-all text-sm pr-10 ${
                      driveUrl && !driveUrlError
                        ? "border-emerald-500 focus:ring-emerald-500/20"
                        : driveUrlError
                        ? "border-red-400 focus:ring-red-400/20"
                        : "border-slate-800 focus:ring-black/10"
                    }`}
                  />
                  {/* Inline status icon */}
                  {driveUrl && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {driveUrlError ? (
                        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                {driveUrlError && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">{driveUrlError}</p>
                )}
                {driveUrl && !driveUrlError && (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">
                    ✓ Valid Google Drive link detected.
                  </p>
                )}
              </div>
            )}

            {/* Status Messages */}
            {status && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 border ${
                  status.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-red-50 text-red-600 border-red-300"
                }`}
              >
                {status.type === "success" ? (
                  <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span className="text-sm font-medium">{status.message}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-slate-700 px-5 py-3 text-sm font-semibold text-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {uploadMode === "DRIVE" ? "Registering..." : "Uploading..."}
                </>
              ) : uploadMode === "DRIVE" ? (
                "Register Drive Document"
              ) : (
                "Upload Document"
              )}
            </button>

            {/* Get docs button */}
            <Link href="get_doc">
            <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-slate-700 px-5 py-3 text-sm font-semibold text-white shadow transition-all cursor-pointer active:scale-[0.98]">
              Get Documents
            </div>
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
