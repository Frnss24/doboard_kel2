"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

const previewCards = [
  {
    title: "Board",
    href: "/login?next=/board",
    description: "Kanban workspace untuk drag & drop task, board switcher, dan report issue.",
    bullets: ["Todo / Doing / Done", "Create & edit task", "Switch board"],
  },
  {
    title: "Timeline",
    href: "/login?next=/timeline",
    description: "Tampilan timeline untuk lihat progres task dalam rentang waktu.",
    bullets: ["Gantt-style view", "Task schedule", "Due date tracking"],
  },
  {
    title: "Reports",
    href: "/login?next=/reports",
    description: "Dashboard analytics untuk status, priority, dan aktivitas terbaru.",
    bullets: ["Status chart", "Priority breakdown", "Weekly velocity"],
  },
  {
    title: "Admin",
    href: "/login?next=/admin",
    description: "Panel admin untuk user management dan moderasi report.",
    bullets: ["User management", "Issue moderation", "Admin analytics"],
  },
];

export default function Home() {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/board");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-57px)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-6 py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="flex flex-col justify-center gap-6">
              <div>
                <p className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Doboard Workspace
                </p>
                <h1 className="mt-4 max-w-xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                  Rapiin task, pantau progres, dan simpan semua kerja tim dalam satu tempat.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Ini adalah landing page publik. Kamu bisa lihat isi sistem dulu, lalu klik fitur mana pun untuk login atau register sebelum masuk ke workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login?next=/board"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  Login / Register
                </Link>
                <Link
                  href="/login?next=/board"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Lihat Board Setelah Masuk
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Board", "Kanban + drag & drop"],
                  ["Timeline", "Gantt-style timeline"],
                  ["Reports", "Analytics dashboard"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {previewCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Preview Page
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">{card.title}</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      Login dulu
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">{card.description}</p>

                  <ul className="mt-4 space-y-2">
                    {card.bullets.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    Buka preview
                    <span aria-hidden="true">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Login/Register", "Masuk dulu sebelum akses task, timeline, dan admin."],
            ["2", "Workspace", "Setelah login, langsung masuk ke board utama."],
            ["3", "Moderasi", "Admin bisa lihat report dan kelola user."],
          ].map(([step, title, desc]) => (
            <div key={step} className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-bold text-blue-700">Step {step}</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
