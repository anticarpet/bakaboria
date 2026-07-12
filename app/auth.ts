// auth.ts
import NextAuth from "next-auth";
import { connectDB } from "@/lib/db";
import { userModel } from "@/models/users";
import { authConfig } from "./auth.config";
import  Credentials  from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
   providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }
        await connectDB();
        const email = (credentials.email as string).toLowerCase().trim();
        const username = credentials.username as string;
        const password = credentials.password as string;
        // Try to find the user
        let user = await userModel.findOne({ email });
        if (user) {
          // User exists, verify password if they have one
          if (!user.password) {
            throw new Error("This email is associated with a Google account. Please sign in with Google.");
          }
          if (user.password !== password) {
            throw new Error("Incorrect password.");
          }
          return {
            id: user._id.toString(),
            name: user.username,
            email: user.email,
            image: user.image || "",
          };
        } else {
          // User doesn't exist, register them!
          if (!username) {
            throw new Error("A username is required to register a new account.");
          }
          const newUser = await userModel.create({
            uid: "", // uid is set below
            username,
            email,
            password, // Plain text as per user instructions
            image: "",
            role: "user",
          });
          // Set the uid to the stringified mongoId so it's consistent
          newUser.uid = newUser._id.toString();
          await newUser.save();
          return {
            id: newUser._id.toString(),
            name: newUser.username,
            email: newUser.email,
            image: "",
          };
        }
      },
    }),
  ],
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
            token.role = dbUser.role;
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
        try {
          await connectDB();
          const dbUser = await userModel.findById(token.mongoId);
          (session.user as any).role = dbUser?.role || "user";
        } catch (err) {
          console.error("session callback – DB error:", err);
          (session.user as any).role = (token.role as string) || "user";
        }
      }
      return session;
    },
  },
});