"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useSupabaseAuth();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/")) return "/board";
    return raw;
  }, [searchParams]);

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    // Check if user is admin
    const checkAndRedirect = async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.role === "admin" && (nextPath === "/" || nextPath === "/board")) {
        router.replace("/admin");
      } else {
        router.replace(nextPath);
      }
    };

    checkAndRedirect();
  }, [authLoading, user, router, nextPath]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (mode === "signup") {
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (data.user && !data.session) {
        setSuccessMessage("Register berhasil. Cek email kamu untuk verifikasi, lalu login.");
        setMode("signin");
      } else {
        setSuccessMessage("Akun berhasil dibuat. Kamu sudah login.");
        router.replace(nextPath);
      }

      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    // Check if admin and redirect accordingly
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    if (loggedInUser) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", loggedInUser.id)
        .maybeSingle();

      if (profile?.role === "admin" && (nextPath === "/" || nextPath === "/board")) {
        router.replace("/admin");
        setSubmitting(false);
        return;
      }
    }

    router.replace(nextPath);
    setSubmitting(false);
  };

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">DoBOARD Auth</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {mode === "signin" ? "Masuk ke akun kamu" : "Buat akun baru"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {mode === "signin"
            ? "Login dulu sebelum menambah task baru."
            : "Register dulu, lalu kamu bisa membuat task di board."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-lg px-3 py-2 transition-colors ${
              mode === "signin" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-2 transition-colors ${
              mode === "signup" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Nama Lengkap</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.5 0-8.27-2.942-9.543-7a9.97 9.97 0 0 1 1.563-3.029m3.14-2.514A9.95 9.95 0 0 1 12 5c4.5 0 8.27 2.942 9.543 7a9.97 9.97 0 0 1-4.293 5.255M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4.657 4.657L3 3m16.657 16.657" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {submitting
              ? "Memproses..."
              : mode === "signin"
                ? "Login"
                : "Register"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-600">
          {mode === "signin" ? (
            <p>
              Belum punya akun?{" "}
              <button
                type="button"
                className="font-semibold text-blue-700 hover:text-blue-800"
                onClick={() => setMode("signup")}
              >
                Register di sini
              </button>
            </p>
          ) : (
            <p>
              Sudah punya akun?{" "}
              <button
                type="button"
                className="font-semibold text-blue-700 hover:text-blue-800"
                onClick={() => setMode("signin")}
              >
                Login di sini
              </button>
            </p>
          )}
          {/* Removed the "Kembali ke board" link per request */}
        </div>
      </div>
    </main>
  );
}
