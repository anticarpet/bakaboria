"use client";

import React, { useState } from "react";

export default function GeminiTestPage() {
  const [docId, setDocId] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmedId = docId.trim();
    if (!trimmedId) return;

    setLoading(true);
    setResponse("");
    setError("");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmedId }),
      });

      const data = await res.json();

      if (res.ok) {
        // Pretty-print the JSON result
        const resultStr =
          typeof data.result === "string"
            ? data.result
            : JSON.stringify(data.result, null, 2);
        setResponse(resultStr);
      } else {
        setError(data.error || "An unknown error occurred.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Gemini PDF Test
          </h1>
          <p className="text-sm text-slate-500">
            Enter a document <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">_id</code> to process it through Gemini Flash 2.5.
          </p>
        </div>

        {/* Input + Button */}
        <div className="bg-white border border-3 border-black rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="docIdInput"
              className="block text-sm font-semibold text-black"
            >
              Document _id
            </label>
            <div className="flex rounded-lg shadow-sm">
              <input
                type="text"
                id="docIdInput"
                placeholder="e.g. 6789abcdef012345..."
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="block w-full rounded-l-lg bg-white border border-slate-800 border-r-0 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !docId.trim()}
                className="inline-flex items-center justify-center px-6 rounded-r-lg bg-black hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  "Enter"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-slate-50 border border-black/10 rounded-xl p-6 text-center text-sm text-slate-500 animate-pulse">
            Processing PDF through Gemini Flash 2.5…
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
              Response
            </h2>
            <div className="bg-slate-50 border border-black/10 rounded-xl p-6 overflow-auto max-h-[600px]">
              <pre className="text-sm text-black whitespace-pre-wrap break-words font-mono leading-relaxed">
                {response}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
