import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TaskModel } from "@/models/Task";
import { userModel } from "@/models/users";
import { auth } from "@/app/auth";

// ─── Helper: get authenticated user from session ────────────────────────────
async function getSessionUser() {
    const session = await auth();
    if (!session?.user) return null;
    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    return { userId, role, session };
}

// ─── GET: Fetch all tasks (admin only) ──────────────────────────────────────
export async function GET() {
    try {
        const sessionUser = await getSessionUser();
        if (!sessionUser || sessionUser.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await connectDB();

        const tasks = await TaskModel.find({})
            .populate("author", "username email image")
            .populate("assignedTo", "username email image")
            .lean()
            .sort({ createdAt: -1 });

        return NextResponse.json(tasks, { status: 200 });
    } catch (error: any) {
        console.error("GET /api/tasks error:", error);
        return NextResponse.json({ error: "Failed to fetch tasks." }, { status: 500 });
    }
}

// ─── POST: Create a new task, or perform an action on an existing task ──────
export async function POST(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser();
        if (!sessionUser || sessionUser.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await connectDB();
        const body = await request.json();
        const { action } = body;

        // ── CREATE a new task ────────────────────────────────────────────────
        if (!action || action === "create") {
            const { name, description, dueDate, points } = body;
            if (!name || !description || !dueDate || !points) {
                return NextResponse.json(
                    { error: "name, description, dueDate, and points are required." },
                    { status: 400 }
                );
            }

            const task = await TaskModel.create({
                name,
                description,
                author: sessionUser.userId,
                dueDate: new Date(dueDate),
                points: Number(points),
                status: "pending",
            });

            const populated = await TaskModel.findById(task._id)
                .populate("author", "username email image")
                .populate("assignedTo", "username email image")
                .lean();

            return NextResponse.json(populated, { status: 201 });
        }

        // ── PICK UP a task (assign to self) ──────────────────────────────────
        if (action === "pickup") {
            const { taskId } = body;
            if (!taskId) {
                return NextResponse.json({ error: "taskId is required." }, { status: 400 });
            }

            const task = await TaskModel.findById(taskId);
            if (!task) {
                return NextResponse.json({ error: "Task not found." }, { status: 404 });
            }

            // Rule: author cannot pick up their own task
            if (task.author.toString() === sessionUser.userId) {
                return NextResponse.json(
                    { error: "You cannot pick up a task you authored." },
                    { status: 403 }
                );
            }

            if (task.status !== "pending") {
                return NextResponse.json(
                    { error: "Task is no longer available for pickup." },
                    { status: 400 }
                );
            }

            task.status = "assigned";
            task.assignedTo = sessionUser.userId;
            await task.save();

            // Add task to user's assignedTasks
            await userModel.findByIdAndUpdate(sessionUser.userId, {
                $addToSet: { assignedTasks: task._id },
            });

            const populated = await TaskModel.findById(task._id)
                .populate("author", "username email image")
                .populate("assignedTo", "username email image")
                .lean();

            return NextResponse.json(populated, { status: 200 });
        }

        // ── SUBMIT (complete) a task ─────────────────────────────────────────
        if (action === "submit") {
            const { taskId } = body;
            if (!taskId) {
                return NextResponse.json({ error: "taskId is required." }, { status: 400 });
            }

            const task = await TaskModel.findById(taskId);
            if (!task) {
                return NextResponse.json({ error: "Task not found." }, { status: 404 });
            }

            // Rule: author cannot submit their own task
            if (task.author.toString() === sessionUser.userId) {
                return NextResponse.json(
                    { error: "You cannot submit a task you authored." },
                    { status: 403 }
                );
            }

            if (task.status !== "assigned") {
                return NextResponse.json(
                    { error: "Task is not in an assigned state." },
                    { status: 400 }
                );
            }

            if (task.assignedTo?.toString() !== sessionUser.userId) {
                return NextResponse.json(
                    { error: "You are not assigned to this task." },
                    { status: 403 }
                );
            }

            task.status = "completed";
            await task.save();

            // Award points to the user
            await userModel.findByIdAndUpdate(sessionUser.userId, {
                $inc: { points: task.points },
            });

            const populated = await TaskModel.findById(task._id)
                .populate("author", "username email image")
                .populate("assignedTo", "username email image")
                .lean();

            return NextResponse.json(populated, { status: 200 });
        }

        // ── FORFEIT a task ───────────────────────────────────────────────────
        if (action === "forfeit") {
            const { taskId } = body;
            if (!taskId) {
                return NextResponse.json({ error: "taskId is required." }, { status: 400 });
            }

            const task = await TaskModel.findById(taskId);
            if (!task) {
                return NextResponse.json({ error: "Task not found." }, { status: 404 });
            }

            if (task.status !== "assigned") {
                return NextResponse.json(
                    { error: "Task is not in an assigned state." },
                    { status: 400 }
                );
            }

            if (task.assignedTo?.toString() !== sessionUser.userId) {
                return NextResponse.json(
                    { error: "You are not assigned to this task." },
                    { status: 403 }
                );
            }

            // Rule: can only forfeit if current date is at least (2 + points/3) days before deadline
            const now = new Date();
            const dueDate = new Date(task.dueDate);
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysUntilDeadline = (dueDate.getTime() - now.getTime()) / msPerDay;
            const requiredDays = 2 + task.points / 3;

            if (daysUntilDeadline < requiredDays) {
                return NextResponse.json(
                    {
                        error: `Cannot forfeit. You need at least ${requiredDays.toFixed(1)} days before the deadline to forfeit. Only ${daysUntilDeadline.toFixed(1)} days remaining.`,
                    },
                    { status: 400 }
                );
            }

            // Remove from user's assignedTasks
            await userModel.findByIdAndUpdate(task.assignedTo, {
                $pull: { assignedTasks: task._id },
            });

            task.status = "pending";
            task.assignedTo = undefined;
            await task.save();

            const populated = await TaskModel.findById(task._id)
                .populate("author", "username email image")
                .populate("assignedTo", "username email image")
                .lean();

            return NextResponse.json(populated, { status: 200 });
        }

        // ── DELETE a task (author only) ──────────────────────────────────────
        if (action === "delete") {
            const { taskId } = body;
            if (!taskId) {
                return NextResponse.json({ error: "taskId is required." }, { status: 400 });
            }

            const task = await TaskModel.findById(taskId);
            if (!task) {
                return NextResponse.json({ error: "Task not found." }, { status: 404 });
            }

            // Clean up: remove from assigned user if any
            if (task.assignedTo) {
                await userModel.findByIdAndUpdate(task.assignedTo, {
                    $pull: { assignedTasks: task._id },
                });
            }

            await TaskModel.findByIdAndDelete(taskId);
            return NextResponse.json({ success: true }, { status: 200 });
        }

        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    } catch (error: any) {
        console.error("POST /api/tasks error:", error);
        return NextResponse.json({ error: "An error occurred." }, { status: 500 });
    }
}
