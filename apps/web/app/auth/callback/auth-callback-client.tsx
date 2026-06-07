"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSessionToken } from "@/lib/api";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing GitHub login...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setMessage("Missing session token.");
      return;
    }

    setSessionToken(token);
    setMessage("Session stored. Redirecting to dashboard...");
    const timeout = window.setTimeout(() => router.replace("/dashboard"), 700);
    return () => window.clearTimeout(timeout);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Authentication</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{message}</h1>
      </div>
    </main>
  );
}

