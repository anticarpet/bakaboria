// middleware.ts  – runs on the Edge runtime before every matched request
import NextAuth from "next-auth";
import { authConfig } from "@/app/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Routes that require an authenticated session
const PROTECTED_PATHS = ["/upload_doc", "/get_doc"];

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;

  const isProtected = PROTECTED_PATHS.some((path) =>
    nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !session) {
    // Redirect to sign-in and remember where they wanted to go
    const signInUrl = new URL("/signIn", nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match every route except Next.js internals and static files
  matcher: ["/((?!_next|favicon.ico|api/auth).*)"],
};

