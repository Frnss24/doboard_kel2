"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ShareAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [message, setMessage] = useState("Memeriksa akses board...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const acceptShare = async () => {
      if (!token) {
        setError("Link share tidak valid.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace(`/login?next=/share/${token}`);
        return;
      }

      setMessage("Menghubungkan kamu ke board...");

      const { data: boardId, error: acceptError } = await supabase.rpc("accept_board_share", {
        share_token: token,
      });

      if (cancelled) return;

      if (acceptError) {
        setError(acceptError.message);
        return;
      }

      if (typeof window !== "undefined" && typeof boardId === "string") {
        window.localStorage.setItem("activeBoardId", boardId);
      }

      router.replace("/");
    };

    acceptShare();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-xl backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Board Share</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Join shared board</h1>
        <p className="mt-2 text-sm text-slate-600">{error ?? message}</p>
        {error && (
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Kembali ke board
          </button>
        )}
      </div>
    </main>
  );
}
