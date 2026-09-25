import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { userModel } from "@/models/users";
import { auth } from "@/app/auth";

// ─── GET: Fetch admin leaderboard and current user's points ──────────────────
export async function GET() {
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

        // Find all admin users
        const admins = await userModel
            .find({ role: "admin" })
            .select("username email points image")
            .lean();

        // Format and sort descending by points
        const leaderboard = admins
            .map((admin) => ({
                _id: admin._id.toString(),
                username: admin.username || "Admin",
                email: admin.email || "",
                points: typeof admin.points === "number" ? admin.points : 0,
                image: admin.image || "",
            }))
            .sort((a, b) => {
                if (b.points !== a.points) {
                    return b.points - a.points;
                }
                return a.username.localeCompare(b.username);
            });

        // Resolve current user points
        const currentUserId = (session.user as any).id;
        const currentUserEmail = session.user.email?.toLowerCase();

        let currentAdmin = leaderboard.find(
            (a) =>
                (currentUserId && a._id === currentUserId) ||
                (currentUserEmail && a.email.toLowerCase() === currentUserEmail)
        );

        let currentUserPoints = currentAdmin ? currentAdmin.points : 0;

        if (!currentAdmin && currentUserId) {
            const userDoc = await userModel.findById(currentUserId).lean();
            if (userDoc) {
                currentUserPoints = typeof userDoc.points === "number" ? userDoc.points : 0;
            }
        }

        return NextResponse.json(
            {
                leaderboard,
                currentUserPoints,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("GET /api/tasks/leaderboard error:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard." },
            { status: 500 }
        );
    }
}
