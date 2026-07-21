"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";

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
  hasPassword: boolean;
  processed: boolean;
  reviewed: boolean;
}

interface HierarchyNodeRef {
  id: string;
  Name: string;
}

export default function GetDocPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  // Search inputs
  const [nameSearch, setNameSearch] = useState("");
  const [tagsSearch, setTagsSearch] = useState("");

  // Folder navigation
  const [folderPath, setFolderPath] = useState<HierarchyNodeRef[]>([]);
  const [folderChildren, setFolderChildren] = useState<HierarchyNodeRef[]>([]);
  const [currentFolderNodeId, setCurrentFolderNodeId] = useState<string | null>(null);
  const [currentFolderFileIds, setCurrentFolderFileIds] = useState<string[] | null>(null); // null = root (search all)

  // Results
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Download state
  const [passwords, setPasswords] = useState<{ [key: string]: string }>({});
  const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const folderPathDisplay =
    folderPath.length > 0
      ? `:${folderPath.map((node) => `/${node.Name}`).join("")}`
      : ":/";

  // Determine whether the user has input something worth searching
  const hasInput = nameSearch.trim() || tagsSearch.trim();

  // ── Core search function ────────────────────────────────────────────────────
  const runSearch = async (
    name = nameSearch,
    tags = tagsSearch,
    fileIds = currentFolderFileIds
  ) => {
    // If nothing is typed, show empty results
    // if (!name.trim() && !tags.trim()) {
    //   setDocuments([]);
    //   return;
    // }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.append("name", name.trim());
      if (tags.trim()) params.append("tags", tags.trim());
      // If we have a folder selected, restrict to its file IDs
      if (fileIds !== null && fileIds.length > 0) {
        params.append("ids", fileIds.join(","));
        // Also pass name/tags for post-filtering on the client side
        // (server will return docs by ids; we filter client-side)
        // Actually we send separate request: fetch ids first, then filter
      } else if (fileIds !== null && fileIds.length === 0) {
        // Folder is selected but has no files
        setDocuments([]);
        setLoading(false);
        return;
      }
      console.log(3423432);

      let url: string;
      if (fileIds !== null) {
        // Folder selected: fetch folder docs, then filter by name/tags client-side
        const folderRes = await fetch(`/api/documents?ids=${fileIds.join(",")}`);
        if (!folderRes.ok) {
          setDocuments([]);
          return;
        }
        const folderDocs: DocumentItem[] = await folderRes.json();
        const nameLower = name.trim().toLowerCase();
        const searchTags = tags
          .split("#")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0);

        const filtered = folderDocs.filter((doc) => {
          const matchesName = !nameLower || doc.name.toLowerCase().includes(nameLower);
          const matchesTags =
            searchTags.length === 0 ||
            searchTags.every((st) => doc.tags.map((t) => t.toLowerCase()).includes(st));
          return matchesName && matchesTags;
        });
        setDocuments(filtered);
        return;
      } else {
        // No folder selected: global search via API
        url = `/api/documents?${params.toString()}`;
        const res = await fetch(url);
        if (res.ok) {
          setDocuments(await res.json());
        } else {
          console.error("Failed to fetch documents");
          setDocuments([]);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Folder navigation ───────────────────────────────────────────────────────
  const loadFolderNode = async (nodeId: string | null) => {
    try {
      const url = nodeId ? `/api/hierarchy?nodeId=${nodeId}` : "/api/hierarchy";
      const res = await fetch(url);
      if (!res.ok) {
        setFolderChildren([]);
        setCurrentFolderFileIds(null);
        return;
      }
      const data = await res.json();
      setFolderChildren(data.children || []);
      if (nodeId === null) {
        // Root: search globally
        setCurrentFolderFileIds(null);
      } else {
        setCurrentFolderFileIds(data.fileIds || []);
      }
    } catch (error) {
      console.error("Folder fetch error:", error);
      setFolderChildren([]);
      setCurrentFolderFileIds(null);
    }
  };

  const handleFolderChildClick = async (child: HierarchyNodeRef) => {
    const newPath = [...folderPath, child];
    setFolderPath(newPath);
    setCurrentFolderNodeId(child.id);
    // Load children and file ids for new node
    try {
      const res = await fetch(`/api/hierarchy?nodeId=${child.id}`);
      if (!res.ok) { setFolderChildren([]); setCurrentFolderFileIds([]); return; }
      const data = await res.json();
      setFolderChildren(data.children || []);
      setCurrentFolderFileIds(data.fileIds || []);
      // Re-run search with new file ids if there's input
      
        runSearch(nameSearch, tagsSearch, data.fileIds || []);
     
        setDocuments([]);
      
    } catch {
      setFolderChildren([]);
      setCurrentFolderFileIds([]);
    }
  };

  const handleFolderPathClick = async (index: number) => {
    console.log(12323);
    if (index < 0) {
      setFolderPath([]);
      setCurrentFolderNodeId(null);
      setCurrentFolderFileIds(null);
      const res = await fetch("/api/hierarchy");
      if (res.ok) {
        const data = await res.json();
        setFolderChildren(data.children || []);
      }
      runSearch(nameSearch, tagsSearch, null);
      
      return;
    }

    const newPath = folderPath.slice(0, index + 1);
    const node = newPath[newPath.length - 1];
    setFolderPath(newPath);
    setCurrentFolderNodeId(node.id);
    try {
      const res = await fetch(`/api/hierarchy?nodeId=${node.id}`);
      if (!res.ok) { setFolderChildren([]); setCurrentFolderFileIds([]); return; }
      const data = await res.json();
      setFolderChildren(data.children || []);
      setCurrentFolderFileIds(data.fileIds || []);
      runSearch(nameSearch, tagsSearch, data.fileIds || []);
      
    } catch {
      setFolderChildren([]);
      setCurrentFolderFileIds([]);
    }
  };

  // Back button: go up one level in folder path
  const handleFolderBack = () => {
    if (folderPath.length === 0) return; // already at root
    handleFolderPathClick(folderPath.length - 2); // go up one
  };

  // ── Initialize folder tree on mount ────────────────────────────────────────
  useEffect(() => {
    loadFolderNode(null);
    // Don't fetch documents on mount — wait for user input
  }, []);

  // Re-run search when inputs change (debounce-free for simplicity)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  // ── Download handling ────────────────────────────────────────────────────────
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
    if (!bytes || bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="relative min-h-screen bg-white text-slate-900 flex flex-col py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden">

      {/* Mobile: watermark logo */}
      <div
        className="pointer-events-none select-none fixed bottom-0 left-0 block sm:hidden"
        style={{ opacity: 0.065, zIndex: 0 }}
        aria-hidden="true"
      >
        <Image
          src="/logo.png"
          alt=""
          width={560}
          height={560}
          style={{ objectFit: "contain", objectPosition: "left bottom" }}
          priority
        />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto space-y-8 flex-1 flex flex-col">

        {/* Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">

          {/* ── Left Panel: Search + Folders ── */}
          <div className="lg:col-span-5 space-y-6">
            {session?.user && (
              <div className=" max-w-2xl flex items-center justify-between mb-6 px-1">
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
                <div className="flex justify-end">
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
                  <Link href="/">
                    <div className="border-4 border-black rounded-xl bg-white text-black  p-1 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg">
                      home
                    </div>
                  </Link>
                </div>
              </div>
            )}

            <div className="bg-white border border-3 border-black rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-black">
                Get a document
              </h1>

              {/* ── Search Inputs ── */}
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                {/* Name */}
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
                      onChange={(e) => {
                        setNameSearch(e.target.value);
                      }}
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

                {/* Tags */}
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
                      onChange={(e) => {
                        setTagsSearch(e.target.value);
                      }}
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
                      setDocuments([]);
                    }}
                    className="w-full text-center text-xs text-slate-500 hover:text-black transition-colors py-1 block underline"
                  >
                    Clear Search Filters
                  </button>
                )}
              </form>

              {/* ── Divider ── */}
              <div className="border-t border-black/10" />

              {/* ── Folder Browser ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-black">
                    Browse Folders
                  </label>
                  {/* Back button */}
                  {folderPath.length > 0 && (
                    <button
                      type="button"
                      onClick={handleFolderBack}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-black border border-black/20 hover:border-black rounded-lg px-2.5 py-1 transition-all"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                  )}
                </div>

                {/* Breadcrumb path */}
                <div className="rounded-lg border border-slate-800 bg-white px-4 py-2.5 text-sm text-black font-mono break-all min-h-[42px] flex items-center">
                  {folderPath.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleFolderPathClick(-1)}
                      className="hover:underline text-left"
                    >
                      {folderPathDisplay}
                    </button>
                  ) : (
                    <span className="flex flex-wrap items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleFolderPathClick(-1)}
                        className="hover:underline shrink-0"
                      >
                        :
                      </button>
                      {folderPath.map((node, index) => (
                        <span key={node.id} className="flex items-center shrink-0">
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => handleFolderPathClick(index)}
                            className="hover:underline"
                          >
                            {node.Name}
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                {/* Children list */}
                {folderChildren.length > 0 && (
                  <div className="space-y-2">
                    {folderChildren.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => handleFolderChildClick(child)}
                        className="w-full text-left text-sm font-medium text-black border border-black/20 hover:border-black hover:bg-slate-50 rounded-lg px-4 py-2.5 transition-all"
                      >
                        → {child.Name}
                      </button>
                    ))}
                  </div>
                )}

                {folderChildren.length === 0 && currentFolderNodeId && (
                  <p className="text-xs text-slate-500">No sub-folders in this location.</p>
                )}

                {/* Folder scope indicator */}
                {currentFolderNodeId && (
                  <p className="text-xs text-slate-400 italic">
                    Search is scoped to: <span className="font-semibold not-italic text-slate-600">{folderPath[folderPath.length - 1]?.Name}</span>
                  </p>
                )}
              </div>

              <Link href="upload_doc">
                <div className="border-4 border-black rounded-xl bg-white text-black font-extrabold p-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg">
                  upload documents
                </div>
              </Link>
            </div>
          </div>

          {/* ── Right Panel: Results ── */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                {!hasInput
                  ? "Results"
                  : currentFolderNodeId
                    ? folderPath[folderPath.length - 1]?.Name || "Folder"
                    : "Results"}
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {!hasInput
                  ? "Enter a name or tag to search"
                  : `${documents.length} ${documents.length === 1 ? "document" : "documents"} found`}
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
              )
              //  : !hasInput ? ( //DEBUG, should be HasInput--------------------------------------------------------------------------------------------------------------------------
              //   /* Nothing typed yet — prompt the user */
              //   <div className="bg-white border border-black/10 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3 h-full">
              //     <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              //     </svg>
              //     <p className="text-slate-500 font-medium text-sm">
              //       Search for documents above
              //     </p>
              //     <p className="text-slate-400 text-xs">
              //       Type a name or tag, then press Enter or click the search icon.
              //       {currentFolderNodeId && " Results are scoped to the selected folder."}
              //     </p>
              //   </div>
              // ) 
              : documents.length === 0 ? (
                <div className="bg-white border border-black/10 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3 h-full">
                  <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-500 font-medium text-sm">
                    No documents found matching your filters.
                  </p>
                  <p className="text-slate-400 text-xs">
                    Try adjusting your search criteria or uploading a new file.
                  </p>
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
                              <div className="min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-black leading-tight">
                                  {doc.name}
                                </h3>
                                {isAdmin && (
                                  <p className="text-xs text-slate-400 font-mono break-all mt-0.5">
                                    {doc._id}
                                  </p>
                                )}
                              </div>

                              {/* Storage-type badge */}
                              {doc.storeMethod === "DRIVE" ? (
                                <span
                                  title="Stored on Google Drive"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-black border border-black shrink-0"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                  </svg>
                                  Drive
                                </span>
                              ) : (
                                <span
                                  title="Stored as PDF"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-black border border-black shrink-0"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  PDF
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

                              {/* Password lock indicator */}
                              {doc.hasPassword && (
                                <span
                                  title="Password protected"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-black border border-amber-400 shrink-0"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  Protected
                                </span>
                              )}

                              {/* Processed badge */}
                              {doc.processed && (
                                <span
                                  title="Processed by Gemini"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-300 shrink-0"
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="#94a3b8" />
                                    <path d="M12 6L13.09 9.26L16 9.77L13.78 12.17L14.45 15.5L12 13.9L9.55 15.5L10.22 12.17L8 9.77L10.91 9.26L12 6Z" fill="#cbd5e1" />
                                  </svg>
                                  Processed
                                </span>
                              )}

                              {/* Reviewed badge */}
                              {doc.reviewed && (
                                <span
                                  title="Reviewed"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-300 shrink-0"
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                                  </svg>
                                  Reviewed
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

                        {/* Bottom action row */}
                        <div className="pt-3 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-end gap-3">
                          {doc.hasPassword ? (
                            <>
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
                            </>
                          ) : (
                            <button
                              onClick={() => handleDownload(doc)}
                              disabled={isDownloading}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-black hover:bg-slate-700 text-white font-semibold text-sm px-5 py-2.5 shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0 tracking-wide"
                            >
                              {isDownloading ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Get Document
                                </>
                              )}
                            </button>
                          )}
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
