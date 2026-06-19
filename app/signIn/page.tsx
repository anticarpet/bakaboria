"use client"

import { signIn, signOut } from "next-auth/react";
import  GoogleSignInBtn  from "@/app/components/GoogleSignInBtn";

export default function SignIn() {
  return (
    <>
      <GoogleSignInBtn/>

      {/* Google Sign Out Button */}
      <button
        onClick={() => signOut( { callbackUrl: '/upload_doc' })}
        className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center gap-2"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        <span className="text-gray-700">Sign Out</span>
      </button>

      {/* You can add Credential Provider buttons here if you implement them */}
    </>



  );
}