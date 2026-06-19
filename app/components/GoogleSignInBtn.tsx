// src/components/GoogleSignInBtn.tsx (or /components/GoogleSignInBtn.tsx)
"use client"

import { signIn } from "next-auth/react";

export default function GoogleSignInBtn() {
  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/upload_doc' })}
      className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center gap-2"
    >
      <img src="https://google.com" alt="Google" className="w-5 h-5" />
      <span className="text-gray-700">Sign in with Google</span>
    </button>
  );
}
