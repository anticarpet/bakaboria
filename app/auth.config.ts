// app/auth.config.ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "bakaboria-secret-key-change-in-production",
  providers: [Google],
  pages: {
    signIn: "/signIn",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
  },
} satisfies NextAuthConfig;
