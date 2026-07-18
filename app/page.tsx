"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  return (
    <div className="relative min-h-screen bg-white text-black flex flex-col items-center justify-center font-sans overflow-hidden">
      {/* Sequential Animation Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,700;1,700&display=swap');

        /* Title styling with Comic Sans fallback */
        .font-comic {
          font-family: "Comic Sans MS", "Comic Sans", "Comic Neue", cursive;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          opacity: 0;
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .delay-logo {
          animation-delay: 0.1s;
        }
        .delay-a {
          animation-delay: 0.25s;
        }
        .delay-b {
          animation-delay: 0.35s;
        }
        .delay-o {
          animation-delay: 0.45s;
        }
        .delay-r {
          animation-delay: 0.55s;
        }
        .delay-i {
          animation-delay: 0.65s;
        }
        .delay-a2 {
          animation-delay: 0.75s;
        }
        .delay-buttons {
          animation-delay: 1.1s;
        }
      `}} />

      {/* Main Container */}
      <main className="flex flex-col items-center justify-center z-10 w-full max-w-2xl px-6 py-12">
        
        {/* Animated Title: logo K + aboria */}
        <div style={{position: "relative", left: "-10%",}} className="flex items-center justify-center font-comic text-6xl sm:text-7xl md:text-8xl font-black italic select-none leading-none mb-16 tracking-tight">
          {/* Logo (K) */}
          <div className="animate-fade-in delay-logo w-[250px] h-[200px] sm:w-[300px] sm:h-[200px] md:w-[400px] md:h-[283px] relative mr-2 sm:mr-3 shrink-0">
            <Image
              src="/logo.png"
              alt="K"
              fill
              className="object-contain"
              priority
            ></Image>
          </div>
          {/* Letters: aboria */}
          <div style={{  position:"absolute", left: "55%", top:"49%" }}>
          <span className="animate-fade-in delay-a">a</span>
          <span className="animate-fade-in delay-b">b</span>
          <span className="animate-fade-in delay-o">o</span>
          <span className="animate-fade-in delay-r">r</span>
          <span className="animate-fade-in delay-i">i</span>
          <span className="animate-fade-in delay-a2">a</span>
        </div></div>

        {/* Navigation Buttons */}
        <div className="animate-fade-in delay-buttons flex flex-col items-center gap-6 w-full max-w-lg">
          {/* Top Row: upload and get docs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            {/* upload_docs */}
            <Link
              href="/upload_doc"
              onClick={(e) => {
                if (!session) {
                  e.preventDefault();
                  router.push("/signIn?callbackUrl=/upload_doc");
                }
              }}
              className="border-4 border-black rounded-xl bg-white text-black font-extrabold p-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg"
            >
              &lt;- upload docs
            </Link>

            {/* get_docs */}
            <Link
              href="/get_doc"
              className="border-4 border-black rounded-xl bg-white text-black font-extrabold p-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg"
            >
              get docs -&gt;
            </Link>
          </div>

          {/* Middle Row: options and sign in */}
          <div className="w-full">
            <Link
              href="/signIn"
              className="block w-full border-4 border-black rounded-xl bg-white text-black font-extrabold p-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg"
            >
              options and sign in
            </Link>
          </div>

          {/* Bottom Row: terminal (if admin signed in) */}
          {isAdmin && (
            <div className="w-full">
              <Link
                href="/terminal"
                className="block w-full border-4 border-black rounded-xl bg-white text-black font-extrabold p-4 text-center hover:bg-black hover:text-white transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] active:scale-[0.97] text-base sm:text-lg"
              >
                terminal
              </Link>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
