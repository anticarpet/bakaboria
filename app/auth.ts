// auth.ts
import NextAuth from "next-auth"

import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google], // Add your providers here
  pages: {
    signIn: '/login', // Optional: Redirect to a custom login page
  }
})