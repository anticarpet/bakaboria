"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/upload_doc";

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      {/* Subtle grid background */}
     

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-white border border-black border-4 rounded-2xl shadow-xl overflow-hidden">
         

          <div className="px-10 py-10 space-y-8">
            {/* Logo / heading */}
            <div className="space-y-2 text-center">
              <div className="flex items-start justify-start gap-2 mb-4">
               
                
                <span className="text-2xl font-bold tracking-tight text-black text-4xl">
                  Sign In
                </span>
              </div>
              <div className="text-xl test-start justify-start font-semibold text-black"><h1 className="text-start">Welcome back!</h1></div>
             
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 uppercase tracking-widest font-medium">
                  Continue with
                </span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <button
              id="google-sign-in-btn"
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-black bg-white px-6 py-3.5 text-sm font-semibold text-black shadow-sm transition-all hover:bg-black hover:text-white active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 group"
            >
              {/* Google "G" SVG – always visible, inverts on hover */}
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  className="group-hover:fill-white transition-all"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  className="group-hover:fill-white transition-all"
                  d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"
                />
                <path
                  fill="#FBBC05"
                  className="group-hover:fill-white transition-all"
                  d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  className="group-hover:fill-white transition-all"
                  d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              Sign in with Google
            </button>

            {/* Footer note */}
            <p className="text-center text-xs text-slate-400 leading-relaxed">
              By signing in, you agree to our{" "}
              <span className="underline cursor-pointer hover:text-black transition-colors">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="underline cursor-pointer hover:text-black transition-colors">
                Privacy Policy
              </span>
              .
            </p>
          </div>
        </div>

        
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}