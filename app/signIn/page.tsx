"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/upload_doc";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        let errMsg = res.error;
        if (errMsg === "CredentialsSignin") {
          errMsg = "Incorrect password or account mismatch.";
        }
        setStatus({ type: "error", message: errMsg });
      } else {
        setStatus({ type: "success", message: "Successfully signed in!" });
        window.location.href = callbackUrl;
      }
    } catch (error: any) {
      console.error(error);
      setStatus({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 uppercase tracking-widest font-medium">
                  OR sign in with Email
                </span>
              </div>
            </div>

            {/* Credentials Sign-In/Up Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-black">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    placeholder="e.g. user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-black">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    required
                    placeholder="e.g. johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-black">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg bg-white border border-slate-800 px-4 py-2.5 text-black placeholder-slate-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                />
              </div>

              {/* Status Messages */}
              {status && (
                <div
                  className={`p-4 rounded-lg flex items-start gap-3 border ${
                    status.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-red-50 text-red-600 border-red-300"
                  }`}
                >
                  {status.type === "success" ? (
                    <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className="text-sm font-medium">{status.message}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-slate-700 px-5 py-3 text-sm font-semibold text-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </form>



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