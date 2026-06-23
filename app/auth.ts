// auth.ts
import NextAuth from "next-auth";
import { connectDB } from "@/lib/db";
import { userModel } from "@/models/users";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    /**
     * Called after a successful OAuth sign-in.
     * We upsert the user in MongoDB so we always have a local record.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await connectDB();
          const existing = await userModel.findOne({ email: user.email });
          if (!existing) {
            await userModel.create({
              uid: user.id,          // Google sub / id token
              username: user.name ?? "Google User",
              email: user.email,
              image: user.image ?? "",
              role: "user",
            });
          }
        } catch (err) {
          console.error("signIn callback - DB error:", err);
          return false; // block sign-in if DB write fails
        }
      }
      return true;
    },

    /**
     * Enrich the JWT with the MongoDB _id so it flows through to the session.
     */
    async jwt({ token, user, account }) {
      if (account && user) {
        // On first sign-in, fetch the MongoDB document and attach its _id
        try {
          await connectDB();
          const dbUser = await userModel.findOne({ email: token.email });
          if (dbUser) {
            token.mongoId = dbUser._id.toString();
          }
        } catch (err) {
          console.error("jwt callback – DB error:", err);
        }
      }
      return token;
    },

    /**
     * Expose mongoId as session.user.id for use across the app.
     */
    async session({ session, token }) {
      if (session.user && token.mongoId) {
        (session.user as any).id = token.mongoId as string;
      }
      return session;
    },
  },
});