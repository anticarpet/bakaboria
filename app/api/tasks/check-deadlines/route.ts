import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TaskModel } from "@/models/Task";
import { userModel } from "@/models/users";
import { auth } from "@/app/auth";

// ─── POST: Check for overdue tasks and penalize ─────────────────────────────
// Called automatically when the tasks page loads (admin only)
export async function POST() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const role = (session.user as any).role;
        if (role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await connectDB();

        const now = new Date();

        // Find all assigned tasks that are past due
        const overdueTasks = await TaskModel.find({
            status: "assigned",
            dueDate: { $lt: now },
        });

        let penalized = 0;

        for (const task of overdueTasks) {
            // Mark as missed
            task.status = "missed";
            await task.save();

            // Deduct points from the assigned user
            if (task.assignedTo) {
                await userModel.findByIdAndUpdate(task.assignedTo, {
                    $inc: { points: -task.points },
                    $pull: { assignedTasks: task._id },
                });
                penalized++;
            }
        }

        // Also mark pending tasks past due as missed (no one picked them up)
        const overduePending = await TaskModel.find({
            status: "pending",
            dueDate: { $lt: now },
        });

        for (const task of overduePending) {
            task.status = "missed";
            await task.save();
        }

        return NextResponse.json(
            {
                success: true,
                penalized,
                expiredPending: overduePending.length,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("POST /api/tasks/check-deadlines error:", error);
        return NextResponse.json({ error: "Failed to check deadlines." }, { status: 500 });
    }
}
