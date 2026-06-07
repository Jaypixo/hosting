import { Suspense } from "react";
import AuthCallbackClient from "./auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="glass max-w-md rounded-3xl p-8 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Authentication</p>
            <h1 className="mt-4 text-2xl font-semibold text-white">Completing GitHub login...</h1>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}

