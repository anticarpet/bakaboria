"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DocumentItem {
  _id: string;
  uid: string;
  name: string;
  tags: string[];
  fileLocation: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  verified: boolean;
  storeMethod: "PDF" | "DRIVE";
}

export default function GetDocPage() {
  const [nameSearch, setNameSearch] = useState("");
  const [tagsSearch, setTagsSearch] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState<{ [key: string]: string }>({});
  const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nameSearch.trim()) params.append("name", nameSearch.trim());
      if (tagsSearch.trim()) params.append("tags", tagsSearch.trim());

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        console.error("Failed to fetch documents");
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handlePasswordChange = (docId: string, val: string) => {
    setPasswords((prev) => ({ ...prev, [docId]: val }));
    if (errors[docId]) {
      setErrors((prev) => ({ ...prev, [docId]: "" }));
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    const docId = doc._id;
    const password = passwords[docId] || "";

    setDownloading((prev) => ({ ...prev, [docId]: true }));
    setErrors((prev) => ({ ...prev, [docId]: "" }));

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId, password }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const contentDisposition = res.headers.get("Content-Disposition");
        let downloadName = doc.name;

        const originalExtension = doc.fileName.includes(".")
          ? doc.fileName.slice(doc.fileName.lastIndexOf("."))
          : "";

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            downloadName = decodeURIComponent(filenameMatch[1]);
          }
        } else {
          if (originalExtension && !downloadName.toLowerCase().endsWith(originalExtension.toLowerCase())) {
            downloadName = `${downloadName}${originalExtension}`;
          }
        }

        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const errData = await res.json();
        setErrors((prev) => ({ ...prev, [docId]: errData.error || "Incorrect password or error downloading." }));
      }
    } catch (err) {
      console.error("Download error:", err);
      setErrors((prev) => ({ ...prev, [docId]: "An unexpected error occurred." }));
    } finally {
      setDownloading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl w-full mx-auto space-y-8 flex-1 flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center">
          <Link
            href="/upload_doc"
            className="text-black hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            ← Upload Document
          </Link>
          
        </div>

        {/* Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">

          {/* Left Panel: Search */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-3 border-black rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-black">
                Get a document
              </h1>

              <form onSubmit={handleSearchSubmit} className="space-y-5">
                {/* Search by Name */}
                <div className="space-y-1.5">
                  <label htmlFor="nameSearch" className="block text-sm font-semibold text-black">
                    Search by Name
                  </label>
                  <div className="flex rounded-lg shadow-sm">
                    <input
                      type="text"
                      id="nameSearch"
                      placeholder="e.g. Physics final"
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                      className="block w-full rounded-l-lg bg-white border border-slate-800 border-r-0 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center px-4 rounded-r-lg bg-black hover:bg-slate-700 text-white transition-all cursor-pointer active:scale-95"
                      title="Search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Search by Tags */}
                <div className="space-y-1.5">
                  <label htmlFor="tagsSearch" className="block text-sm font-semibold text-black">
                    Filter by Tags
                  </label>
                  <div className="flex rounded-lg shadow-sm">
                    <input
                      type="text"
                      id="tagsSearch"
                      placeholder="e.g. #physics #CUFE"
                      value={tagsSearch}
                      onChange={(e) => setTagsSearch(e.target.value)}
                      className="block w-full rounded-l-lg bg-white border border-slate-800 border-r-0 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center px-4 rounded-r-lg bg-black hover:bg-slate-700 text-white transition-all cursor-pointer active:scale-95"
                      title="Search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Clear filters */}
                {(nameSearch || tagsSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameSearch("");
                      setTagsSearch("");
                      setTimeout(() => fetchDocuments(), 0);
                    }}
                    className="w-full text-center text-xs text-slate-500 hover:text-black transition-colors py-2 block underline"
                  >
                    Clear Search Filters
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                Results
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {documents.length} {documents.length === 1 ? "document" : "documents"} found
              </span>
            </div>

            <div className="flex-1 space-y-4 min-h-[300px]">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-black/10 rounded-xl p-6 animate-pulse space-y-3">
                      <div className="flex justify-between">
                        <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                        <div className="h-5 bg-slate-200 rounded w-16"></div>
                      </div>
                      <div className="h-8 bg-slate-100 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="bg-white border border-black/10 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3 h-full">
                  <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-500 font-medium text-sm">No documents found matching your filters.</p>
                  <p className="text-slate-400 text-xs">Try adjusting your search criteria or uploading a new file.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => {
                    const isDownloading = downloading[doc._id] || false;
                    const errorMsg = errors[doc._id] || "";

                    return (
                      <div
                        key={doc._id}
                        className="bg-white hover:bg-slate-50 border border-black/20 hover:border-black/40 rounded-xl p-5 sm:p-6 transition-all duration-200 shadow-sm flex flex-col space-y-4"
                      >
                        {/* Title, storage badge, verified badge, and size */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg font-bold text-black leading-tight">
                                {doc.name}
                              </h3>

                              {/* Storage-type badge */}
                              {doc.storeMethod === "DRIVE" ? (
                                <span
                                  title="Stored on Google Drive"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-black border border-black shrink-0"
                                >
                                  {/* Cloud icon */}
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                  </svg>
                                  
                                </span>
                              ) : (
                                <span
                                  title="Stored locally"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-black border border-black shrink-0"
                                >
                                  {/* Page icon */}
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  
                                </span>
                              )}

                              {/* Verified badge */}
                              {doc.verified && (
                                <span
                                  title="Verified document"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-black border border-emerald-700 shrink-0"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Verified
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {doc.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-black border border-black/20"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-black/60 bg-slate-100 border border-black/10 px-2.5 py-1 rounded-lg shrink-0">
                            {formatSize(doc.fileSize)}
                          </span>
                        </div>

                        {/* Password input and Download button */}
                        <div className="pt-3 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-end gap-3">
                          <div className="flex items-center gap-2 w-full sm:max-w-xs">
                            <label className="text-xs font-semibold text-slate-500 shrink-0">
                              password:
                            </label>
                            <input
                              type="password"
                              placeholder="Enter password..."
                              value={passwords[doc._id] || ""}
                              onChange={(e) => handlePasswordChange(doc._id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !isDownloading) {
                                  handleDownload(doc);
                                }
                              }}
                              className="block w-full rounded-lg bg-white border border-slate-800 px-3 py-1.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/10 text-xs transition-all"
                            />
                          </div>

                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={isDownloading}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-black hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2 shadow transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                          >
                            {isDownloading ? (
                              <>
                                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Downloading...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </>
                            )}
                          </button>
                        </div>

                        {/* Error message */}
                        {errorMsg && (
                          <div className="text-right text-xs font-semibold text-red-500">
                            ⚠️ {errorMsg}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
