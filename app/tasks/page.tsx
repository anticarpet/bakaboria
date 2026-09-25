"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PopulatedUser {
    _id: string;
    username: string;
    email: string;
    image?: string;
}

interface Task {
    _id: string;
    name: string;
    description: string;
    author: PopulatedUser;
    assignedTo?: PopulatedUser | null;
    dueDate: string;
    points: number;
    status: "pending" | "assigned" | "completed" | "missed";
    createdAt: string;
}

interface AdminLeaderboardEntry {
    _id: string;
    username: string;
    email: string;
    points: number;
    image?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
    const now = new Date();
    const due = new Date(dateStr);
    return (due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function canForfeit(task: Task): { allowed: boolean; reason?: string } {
    const days = daysUntil(task.dueDate);
    const required = 2 + task.points / 3;
    if (days < required) {
        return {
            allowed: false,
            reason: `Need ${required.toFixed(1)}d before deadline, only ${days.toFixed(1)}d left`,
        };
    }
    return { allowed: true };
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function TasksPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const [authorized, setAuthorized] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [leaderboard, setLeaderboard] = useState<AdminLeaderboardEntry[]>([]);
    const [userPoints, setUserPoints] = useState<number | null>(null);
    const [leaderboardLoading, setLeaderboardLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");

    // Create task form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTask, setNewTask] = useState({
        name: "",
        description: "",
        dueDate: "",
        points: "",
    });
    const [createError, setCreateError] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    const userId = (session?.user as any)?.id;

    // ── Auth guard ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (sessionStatus === "loading") return;
        const role = (session?.user as { role?: string } | undefined)?.role;
        if (role !== "admin") {
            router.replace("/");
            return;
        }
        setAuthorized(true);
    }, [session, sessionStatus, router]);

    // ── Fetch tasks & leaderboard ─────────────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        try {
            // Check deadlines first
            await fetch("/api/tasks/check-deadlines", { method: "POST" });
            const [tasksRes, leaderboardRes] = await Promise.all([
                fetch("/api/tasks"),
                fetch("/api/tasks/leaderboard"),
            ]);
            if (tasksRes.ok) {
                const data = await tasksRes.json();
                setTasks(data);
            }
            if (leaderboardRes.ok) {
                const lbData = await leaderboardRes.json();
                setLeaderboard(lbData.leaderboard || []);
                if (typeof lbData.currentUserPoints === "number") {
                    setUserPoints(lbData.currentUserPoints);
                }
            }
        } catch (err) {
            console.error("Failed to fetch tasks/leaderboard:", err);
        } finally {
            setLoading(false);
            setLeaderboardLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authorized) fetchTasks();
    }, [authorized, fetchTasks]);

    // ── Task actions ──────────────────────────────────────────────────────────
    const performAction = async (action: string, taskId: string) => {
        setActionLoading(true);
        setActionError("");
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, taskId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setActionError(data.error || "Action failed.");
                return;
            }
            // Refresh tasks and close modal
            await fetchTasks();
            setSelectedTask(null);
        } catch (err: any) {
            setActionError(err.message || "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateError("");
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    name: newTask.name,
                    description: newTask.description,
                    dueDate: newTask.dueDate,
                    points: Number(newTask.points),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setCreateError(data.error || "Failed to create task.");
                return;
            }
            setNewTask({ name: "", description: "", dueDate: "", points: "" });
            setShowCreateForm(false);
            await fetchTasks();
        } catch (err: any) {
            setCreateError(err.message || "Network error.");
        } finally {
            setCreateLoading(false);
        }
    };

    // ── Categorize tasks ──────────────────────────────────────────────────────
    const myTasks = tasks.filter(
        (t) =>
            t.assignedTo?._id === userId &&
            (t.status === "assigned" || t.status === "completed")
    );
    const pendingTasks = tasks.filter((t) => t.status === "pending");
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const missedTasks = tasks.filter((t) => t.status === "missed");

    const currentUserFromLb = leaderboard.find(
        (u) =>
            u._id === userId ||
            (session?.user?.email &&
                u.email.toLowerCase() === session.user.email.toLowerCase())
    );
    const displayPoints =
        userPoints !== null
            ? userPoints
            : currentUserFromLb
            ? currentUserFromLb.points
            : 0;

    if (sessionStatus === "loading" || !authorized) return null;

    return (
        <div className="relative min-h-screen bg-white text-slate-900 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden">
            {/* Inline animation styles */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-fade-in-fast {
                    animation: fadeIn 0.2s ease forwards;
                }
            `,
                }}
            />

            {/* ── Logo watermark ── */}
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

            <div className="relative z-10 max-w-6xl w-full space-y-6">
                {/* ── Header ── */}
                <div className="flex justify-between items-center">
                    <Link
                        href="/"
                        className="text-black hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        ← Back to Home
                    </Link>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="text-4xl sm:text-5xl font-black text-black tracking-tight select-none">
                            Tasks
                        </div>
                        <span className="text-sm sm:text-base font-extrabold text-black bg-slate-100 border-2 border-black rounded-xl px-3 py-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] select-none">
                            You have {leaderboardLoading && userPoints === null ? "..." : displayPoints} points
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="border-4 border-black rounded-xl bg-white text-black font-extrabold p-2 px-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base"
                        >
                            {showCreateForm ? "cancel" : "+ new task"}
                        </button>
                        <Link href="/">
                            <div className="border-4 border-black rounded-xl bg-white text-black p-2 px-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg">
                                home
                            </div>
                        </Link>
                    </div>
                </div>

                {/* ── Create Task Form ── */}
                {showCreateForm && (
                    <div className="animate-slide-up bg-white border-4 border-black rounded-xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-black mb-4">
                            Create New Task
                        </h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-black">
                                        Task Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newTask.name}
                                        onChange={(e) =>
                                            setNewTask({ ...newTask, name: e.target.value })
                                        }
                                        placeholder="e.g. Prepare slides"
                                        className="block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-black">
                                        Points
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={newTask.points}
                                        onChange={(e) =>
                                            setNewTask({ ...newTask, points: e.target.value })
                                        }
                                        placeholder="e.g. 10"
                                        className="block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-black">
                                    Description
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newTask.description}
                                    onChange={(e) =>
                                        setNewTask({ ...newTask, description: e.target.value })
                                    }
                                    placeholder="Describe the task..."
                                    className="block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 text-sm resize-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-black">
                                    Due Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={newTask.dueDate}
                                    onChange={(e) =>
                                        setNewTask({ ...newTask, dueDate: e.target.value })
                                    }
                                    className="block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 text-sm"
                                />
                            </div>
                            {createError && (
                                <p className="text-sm font-semibold text-red-600">
                                    ⚠️ {createError}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={createLoading}
                                className="w-full border-4 border-black rounded-xl bg-black text-white font-extrabold p-3 text-center hover:bg-white hover:text-black transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base disabled:opacity-50"
                            >
                                {createLoading ? "Creating..." : "Create Task"}
                            </button>
                        </form>
                    </div>
                )}

                {/* ── Two-Column Layout ── */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2].map((i) => (
                            <div
                                key={i}
                                className="bg-white border-4 border-black rounded-xl p-6 shadow-xl min-h-[400px] animate-pulse"
                            >
                                <div className="h-6 bg-slate-200 rounded w-1/3 mb-6" />
                                <div className="space-y-4">
                                    {[1, 2, 3].map((j) => (
                                        <div
                                            key={j}
                                            className="h-20 bg-slate-100 rounded-lg"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ── My Tasks Column ── */}
                        <div className="bg-white border-4 border-black rounded-xl p-6 shadow-xl min-h-[400px]">
                            <h2 className="text-2xl font-black text-black tracking-tight mb-6 select-none">
                                my tasks
                            </h2>

                            {myTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <svg
                                        className="h-12 w-12 mb-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                        />
                                    </svg>
                                    <p className="text-sm font-medium">
                                        No tasks assigned to you
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {myTasks.map((task) => (
                                        <button
                                            key={task._id}
                                            onClick={() => {
                                                setSelectedTask(task);
                                                setActionError("");
                                            }}
                                            className="w-full text-left border-2 border-black rounded-lg p-4 hover:bg-slate-50 transition-all duration-150 active:scale-[0.98] group"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-black text-sm truncate group-hover:underline">
                                                        {task.name}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        due{" "}
                                                        {formatDate(task.dueDate)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm font-black text-black">
                                                        {task.points}pts
                                                    </span>
                                                    {task.status ===
                                                        "completed" && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-300">
                                                            ✓ done
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Completed & Missed summaries */}
                            {(completedTasks.length > 0 ||
                                missedTasks.length > 0) && (
                                <div className="mt-6 pt-4 border-t border-black/10">
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                                        History
                                    </p>
                                    <div className="flex gap-4 text-xs">
                                        <span className="text-slate-500">
                                            ✓ {completedTasks.length} completed
                                        </span>
                                        <span className="text-slate-400">
                                            ✗ {missedTasks.length} missed
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Pending Tasks Column ── */}
                        <div className="bg-white border-4 border-black rounded-xl p-6 shadow-xl min-h-[400px]">
                            <h2 className="text-2xl font-black text-black tracking-tight mb-6 select-none">
                                pending tasks
                            </h2>

                            {pendingTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <svg
                                        className="h-12 w-12 mb-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <p className="text-sm font-medium">
                                        No pending tasks
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingTasks.map((task) => {
                                        const isAuthor =
                                            task.author._id === userId;
                                        return (
                                            <button
                                                key={task._id}
                                                onClick={() => {
                                                    setSelectedTask(task);
                                                    setActionError("");
                                                }}
                                                className="w-full text-left border-2 border-black/30 rounded-lg p-4 hover:border-black hover:bg-slate-50 transition-all duration-150 active:scale-[0.98] group"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-black text-sm truncate group-hover:underline">
                                                                {task.name}
                                                            </h3>
                                                            {isAuthor && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-300 shrink-0">
                                                                    yours
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            by{" "}
                                                            {task.author
                                                                .username}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            due{" "}
                                                            {formatDate(
                                                                task.dueDate
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-black text-black shrink-0">
                                                        {task.points}pts
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Leaderboard Section ── */}
                <div className="bg-white border-4 border-black rounded-xl p-6 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-black tracking-tight select-none">
                                leaderboard
                            </h2>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded-full px-2.5 py-0.5">
                                admin rankings
                            </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                            {leaderboard.length} {leaderboard.length === 1 ? "admin" : "admins"} • sorted descending
                        </span>
                    </div>

                    {leaderboardLoading ? (
                        <div className="space-y-3 animate-pulse">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="h-14 bg-slate-100 rounded-lg border-2 border-black/10"
                                />
                            ))}
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <svg
                                className="h-10 w-10 mb-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <p className="text-sm font-medium">No admin users found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead>
                                    <tr className="border-b-2 border-black text-xs uppercase tracking-wider text-slate-500">
                                        <th className="py-3 px-3 w-16 text-center font-black">Rank</th>
                                        <th className="py-3 px-4 font-black">Admin</th>
                                        <th className="py-3 px-4 font-black">Email</th>
                                        <th className="py-3 px-4 text-right font-black">Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/10 text-sm">
                                    {leaderboard.map((admin, index) => {
                                        const isCurrentUser =
                                            admin._id === userId ||
                                            (session?.user?.email &&
                                                admin.email.toLowerCase() ===
                                                    session.user.email.toLowerCase());
                                        const rank = index + 1;
                                        return (
                                            <tr
                                                key={admin._id}
                                                className={`transition-colors ${
                                                    isCurrentUser
                                                        ? "bg-slate-50 font-medium"
                                                        : "hover:bg-slate-50/60"
                                                }`}
                                            >
                                                <td className="py-3 px-3 text-center">
                                                    <span
                                                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black border-2 border-black ${
                                                            rank === 1
                                                                ? "bg-amber-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                                : rank === 2
                                                                ? "bg-slate-200 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                                : rank === 3
                                                                ? "bg-amber-100 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                                : "bg-white text-slate-700"
                                                        }`}
                                                    >
                                                        {rank}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        {admin.image ? (
                                                            <img
                                                                src={admin.image}
                                                                alt={admin.username}
                                                                className="w-7 h-7 rounded-full border border-black object-cover shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-black text-white font-black text-xs flex items-center justify-center shrink-0">
                                                                {admin.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-black">
                                                                {admin.username}
                                                            </span>
                                                            {isCurrentUser && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black text-white">
                                                                    you
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 font-mono text-xs break-all sm:break-normal">
                                                    {admin.email}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="inline-block font-black text-sm sm:text-base text-black px-2.5 py-0.5 rounded-lg border-2 border-black bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                        {admin.points} pts
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Task Detail Modal ── */}
            {selectedTask && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-fast"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setSelectedTask(null);
                            setActionError("");
                        }
                    }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/30" />

                    {/* Modal */}
                    <div className="relative bg-white border-4 border-black rounded-xl p-6 sm:p-8 shadow-2xl max-w-md w-full animate-slide-up max-h-[85vh] overflow-y-auto">
                        {/* Close button */}
                        <button
                            onClick={() => {
                                setSelectedTask(null);
                                setActionError("");
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-black transition-colors"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* Task name & points */}
                        <div className="flex items-start justify-between gap-3 mb-1">
                            <h3 className="text-xl font-black text-black tracking-tight">
                                {selectedTask.name}
                            </h3>
                            <span className="text-lg font-black text-black shrink-0">
                                {selectedTask.points}pts
                            </span>
                        </div>

                        {/* Author */}
                        <p className="text-xs text-slate-400 mb-4">
                            by {selectedTask.author.username}
                        </p>

                        {/* Description */}
                        <div className="bg-slate-50 border border-black/10 rounded-lg p-4 mb-4">
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {selectedTask.description}
                            </p>
                        </div>

                        {/* Meta info */}
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">
                                    Due
                                </span>
                                <span className="text-black font-bold">
                                    {formatDate(selectedTask.dueDate)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">
                                    Status
                                </span>
                                <span
                                    className={`font-bold ${
                                        selectedTask.status === "pending"
                                            ? "text-slate-500"
                                            : selectedTask.status === "assigned"
                                            ? "text-black"
                                            : selectedTask.status ===
                                              "completed"
                                            ? "text-slate-400"
                                            : "text-slate-300"
                                    }`}
                                >
                                    {selectedTask.status}
                                </span>
                            </div>
                            {selectedTask.assignedTo && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">
                                        Assigned to
                                    </span>
                                    <span className="text-black font-bold">
                                        {selectedTask.assignedTo.username}
                                    </span>
                                </div>
                            )}
                            {selectedTask.status === "assigned" && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">
                                        Forfeit window
                                    </span>
                                    <span className="text-slate-600 text-xs">
                                        {(
                                            2 +
                                            selectedTask.points / 3
                                        ).toFixed(1)}
                                        d before deadline
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {actionError && (
                            <p className="text-sm font-semibold text-red-600 mb-4">
                                ⚠️ {actionError}
                            </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-3">
                            {/* Pending task → Pick up (if not author) */}
                            {selectedTask.status === "pending" &&
                                selectedTask.author._id !== userId && (
                                    <button
                                        onClick={() =>
                                            performAction(
                                                "pickup",
                                                selectedTask._id
                                            )
                                        }
                                        disabled={actionLoading}
                                        className="w-full border-4 border-black rounded-xl bg-black text-white font-extrabold p-3 text-center hover:bg-white hover:text-black transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] disabled:opacity-50"
                                    >
                                        {actionLoading
                                            ? "..."
                                            : "pick up task"}
                                    </button>
                                )}

                            {/* Pending task & author */}
                            {selectedTask.status === "pending" &&
                                selectedTask.author._id === userId && (
                                    <p className="text-xs text-slate-400 text-center italic">
                                        You authored this task — you cannot pick
                                        it up.
                                    </p>
                                )}

                            {/* Assigned to me → Submit or Forfeit */}
                            {selectedTask.status === "assigned" &&
                                selectedTask.assignedTo?._id === userId && (
                                    <>
                                        {selectedTask.author._id !== userId && (
                                            <button
                                                onClick={() =>
                                                    performAction(
                                                        "submit",
                                                        selectedTask._id
                                                    )
                                                }
                                                disabled={actionLoading}
                                                className="w-full border-4 border-black rounded-xl bg-black text-white font-extrabold p-3 text-center hover:bg-white hover:text-black transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] disabled:opacity-50"
                                            >
                                                {actionLoading
                                                    ? "..."
                                                    : "submit task"}
                                            </button>
                                        )}

                                        <button
                                            onClick={() =>
                                                performAction(
                                                    "forfeit",
                                                    selectedTask._id
                                                )
                                            }
                                            disabled={
                                                actionLoading ||
                                                !canForfeit(selectedTask)
                                                    .allowed
                                            }
                                            title={
                                                canForfeit(selectedTask)
                                                    .reason || ""
                                            }
                                            className="w-full border-2 border-black/30 rounded-xl bg-white text-slate-600 font-bold p-3 text-center hover:border-black hover:text-black transition-all duration-200 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                                        >
                                            {actionLoading
                                                ? "..."
                                                : canForfeit(selectedTask)
                                                      .allowed
                                                ? "forfeit task"
                                                : `forfeit locked — ${
                                                      canForfeit(selectedTask)
                                                          .reason
                                                  }`}
                                        </button>
                                    </>
                                )}

                            {/* Author can delete their own pending task */}
                            {selectedTask.author._id === userId &&
                                selectedTask.status === "pending" && (
                                    <button
                                        onClick={() =>
                                            performAction(
                                                "delete",
                                                selectedTask._id
                                            )
                                        }
                                        disabled={actionLoading}
                                        className="w-full border-2 border-black/20 rounded-xl bg-white text-slate-400 font-bold p-2 text-center hover:border-red-400 hover:text-red-500 transition-all duration-200 active:scale-[0.97] disabled:opacity-50 text-xs"
                                    >
                                        {actionLoading
                                            ? "..."
                                            : "delete task"}
                                    </button>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
