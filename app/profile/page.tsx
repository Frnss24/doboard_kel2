"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, loading } = useSupabaseAuth();
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Prefer reading name from users table to reflect stored profile
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data?.name) {
        setName(data.name as string);
        return;
      }

      setName((user.user_metadata as any)?.full_name ?? user.email ?? "");
    })();
  }, [user]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!user) return (
    <main className="p-6">
      <p className="text-sm text-gray-600">Kamu harus login dulu.</p>
      <Link href="/login" className="text-blue-600">Login</Link>
    </main>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword && newPassword.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("Password konfirmasi tidak cocok");
      return;
    }

    // If changing password, require old password and verify it
    if (newPassword) {
      if (!oldPassword) {
        setError("Masukkan password lama untuk mengubah password");
        return;
      }

      // Verify old password by attempting sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email ?? "",
        password: oldPassword,
      });

      if (verifyError) {
        setError("Password lama salah");
        return;
      }
    }

    setSaving(true);

    try {
      // Update auth metadata (full_name) and optionally password
      const updatePayload: any = { data: { full_name: name } };
      if (newPassword) updatePayload.password = newPassword;

      const { error: authError } = await supabase.auth.updateUser(updatePayload as any);
      if (authError) {
        setError(authError.message);
        setSaving(false);
        return;
      }

      // Also update users table name so app reads consistent value
      const { error: dbError } = await supabase.from("users").update({ name }).eq("id", user.id);
      if (dbError) {
        setError(dbError.message);
        setSaving(false);
        return;
      }

      setNewPassword("");
      setOldPassword("");
      setConfirmPassword("");
      setMessage("Profile berhasil diperbarui.");
    } catch (err: any) {
      setError(err?.message ?? "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-start justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
        <p className="mt-2 text-sm text-slate-600">Ubah nama dan password akunmu di sini.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nama Lengkap</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password Lama</label>
            <input
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              type="password"
              placeholder="Masukkan password lama (wajib saat ubah password)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password Baru</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="Kosongkan kalau tidak ingin mengubah"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Konfirmasi Password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Ulangi password baru"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    </main>
  );
}
