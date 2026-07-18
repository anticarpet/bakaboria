"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface HistoryItem {
  prompt?: string;
  command?: string;
  output?: string;
}

interface CurrentNode {
  id: string;
  Name: string;
  tag_Name: string;
}

export default function TerminalPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [currentNode, setCurrentNode] = useState<CurrentNode | null>(null);
  const [path, setPath] = useState<CurrentNode[]>([
    { id: "", Name: "CUFE", tag_Name: "CUFE" }
  ]);
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; name: string } | null>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([
    { output: "Welcome to CUFE Terminal. Type 'help' to see all commands and their syntax." },
    // { prompt: "# #CUFE > ", command: "root" },
    // { prompt: "#> ", command: "navigate" },
    // { output: "╠═ #CUFE\n╠═ #BUE\n╠═ #GUC\n╠═ #MAST" },
    // { prompt: "#> ", command: "CUFE" },
    // { output: "╠═ #MEC\n╠═ #EECE\n╠═ #CMP" },
    // { prompt: "# #CUFE > ", command: "create ARC ARCH" },
    // { output: "node ARC created sucessfully." },
    // { prompt: "# #CUFE > ", command: "navigate" },
    // { output: "╠═ #MEC\n╠═ #EECE\n╠═ #CMP\n╠═ #ARC" }
  ]);
  const [loading, setLoading] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and scroll to bottom
  const focusInput = () => {
    inputRef.current?.focus();
  };

  useEffect(() => {
    focusInput();
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      router.replace("/get_doc");
      return;
    }

    setAuthorized(true);
  }, [session, sessionStatus, router]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!loading) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [history, loading]);

  // Sync state with database on mount (resolve current CUFE node ID)
  useEffect(() => {
    const syncCurrentNode = async () => {
      try {
        const res = await fetch("/api/hierarchy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "CUFE", currentNodeId: null })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.currentNode) {
            setCurrentNode(data.currentNode);
            setPath([data.currentNode]);
          }
        }
      } catch (err) {
        console.error("Failed to sync current node:", err);
      }
    };
    syncCurrentNode();
  }, []);

  const getPromptPrefix = (currentPath: CurrentNode[], currentDoc: { name: string } | null) => {
    if (currentPath.length === 0) return `#> `;
    const pathStr = currentPath.map(n => `#${n.Name}`).join(" ");
    if (currentDoc) {
      return `# ${pathStr} /${currentDoc.name} > `;
    }
    return `# ${pathStr} > `;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const currentPrompt = getPromptPrefix(path, selectedDoc);
    
    // Add command to history
    setHistory((prev) => [...prev, { prompt: currentPrompt, command: trimmedInput }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmedInput,
          currentNodeId: currentNode?.id || null,
          selectedDocId: selectedDoc?.id || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.output) {
          setHistory((prev) => [...prev, { output: data.output }]);
        }

        if (data.action === "root") {
          setCurrentNode(null);
          setPath([]);
          setSelectedDoc(null);
        } else if (data.action === "cd") {
          setPath((prev) => {
            const nextPath = prev.slice(0, -1);
            const parentNode = nextPath[nextPath.length - 1] || null;
            setCurrentNode(parentNode);
            return nextPath;
          });
          setSelectedDoc(null);
        } else if (data.action === "navigate" && data.currentNode) {
          setPath((prev) => {
            const nextPath = [...prev];
            const idx = nextPath.findIndex(n => n.id === data.currentNode.id);
            if (idx !== -1) {
              const sliced = nextPath.slice(0, idx + 1);
              setCurrentNode(sliced[sliced.length - 1] || null);
              return sliced;
            } else {
              nextPath.push(data.currentNode);
              setCurrentNode(data.currentNode);
              return nextPath;
            }
          });
          setSelectedDoc(null);
        } else if (data.action === "select_doc") {
          setSelectedDoc(data.selectedDoc);
        } else if (data.action === "rename_doc") {
          setSelectedDoc((prev) => prev ? { ...prev, name: data.name } : null);
        } else if (data.action === "rename_hier") {
          setCurrentNode(data.currentNode);
          setPath((prev) => {
            return prev.map((n) => n.id === data.currentNode.id ? data.currentNode : n);
          });
        }
      } else {
        const errData = await res.json();
        setHistory((prev) => [...prev, { output: `Error: ${errData.error || "Failed to execute command."}` }]);
      }
    } catch (err: any) {
      setHistory((prev) => [...prev, { output: `Network error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const promptPrefix = getPromptPrefix(path, selectedDoc);

  if (sessionStatus === "loading" || !authorized) {
    return null;
  }

  return (
    <div 
      className="relative min-h-screen bg-white text-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden cursor-text"
      onClick={focusInput}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .terminal-font {
          font-family: 'Ubuntu Mono', monospace;
        }
        .terminal-line {
          line-height: 1.15;
        }
        /* Custom pulsing block cursor */
        .terminal-cursor {
          display: inline-block;
          width: 8px;
          height: 15px;
          background-color: #3b82f6; /* light blue */
          margin-left: 2px;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from, to { background-color: transparent }
          50% { background-color: #3b82f6 }
        }
      `}} />

      {/* ── Logo watermark (matches styling guidelines & other pages) ── */}
      <div
        className="pointer-events-none select-none fixed bottom-0 left-0 hidden sm:block"
        style={{ opacity: 0.065, zIndex: 0 }}
        aria-hidden="true"
      >
        <Image
          src="/logo.png"
          alt=""
          width={1360}
          height={1120}
          style={{ objectFit: "contain", objectPosition: "left bottom" }}
          priority
        />
      </div>
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

      <div className="relative z-10 max-w-4xl w-full space-y-6">
        {/* Navigation Link back to upload */}
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-black hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Title */}
        <div className="text-5xl font-black text-black tracking-tight select-none">
          Terminal
        </div>

        {/* Terminal Box */}
        <div className="bg-white border-4 border-black rounded-xl p-6 shadow-xl min-h-[500px] flex flex-col justify-between terminal-font text-lg text-black leading-[1.2]">
          
          {/* History */}
          <div className="space-y-0.5 overflow-y-auto max-h-[450px] terminal-line">
            {history.map((item, idx) => (
              <div key={idx}>
                {item.command !== undefined ? (
                  <div className="flex items-center">
                    <span className="font-bold select-none">{item.prompt}</span>
                    <span>{item.command}</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap select-text">{item.output}</div>
                )}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Prompt / Input */}
          <form onSubmit={handleSubmit} className="flex items-center mt-3 pt-3 border-t border-black/10">
            <span className="font-bold select-none whitespace-nowrap mr-1">
              {promptPrefix}
            </span>
            <div className="flex-1 flex items-center relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-transparent text-black border-none outline-none focus:outline-none focus:ring-0 p-0 m-0 terminal-font text-lg"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              {/* Custom blue box cursor at the end of input if focused/active */}
              {!input && <span className="terminal-cursor" />}
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
