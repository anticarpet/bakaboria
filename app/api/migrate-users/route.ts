import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { userModel } from "@/models/users";
import { auth } from "@/app/auth";

// ─── POST: Backfill existing users with points and assignedTasks fields ─────
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

        // Update all users that don't yet have the points field
        const result = await userModel.updateMany(
            {
                $or: [
                    { points: { $exists: false } },
                    { assignedTasks: { $exists: false } },
                ],
            },
            {
                $set: {
                    points: 0,
                    assignedTasks: [],
                },
            }
        );

        return NextResponse.json(
            {
                success: true,
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("POST /api/migrate-users error:", error);
        return NextResponse.json({ error: "Migration failed." }, { status: 500 });
    }
}
