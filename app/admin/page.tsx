"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

interface Stats {
  totalUsers: number;
  totalBoards: number;
  totalTasks: number;
  weeklySignups: { week: string; count: number }[];
}

interface Report {
  id: string;
  reporter_email: string;
  title: string;
  message: string;
  status: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at?: string | null;
  reporter_id?: string | null;
}

const STATUS_OPTIONS = ["open", "in_review", "resolved"];

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "open";
  const styles: Record<string, string> = {
    open: "bg-yellow-50 text-yellow-700 border-yellow-200",
    in_review: "bg-blue-50 text-blue-700 border-blue-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
  };
  const labels: Record<string, string> = {
    open: "Open",
    in_review: "In Review",
    resolved: "Resolved",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[s] ?? styles.open}`}>
      {labels[s] ?? s}
    </span>
  );
}

export default function AdminDashboard() {
  const { user } = useSupabaseAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBoards: 0,
    totalTasks: 0,
    weeklySignups: [],
  });
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReports, setEditingReports] = useState<
    Record<string, { status: string; decision_note: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch counts
      const [usersRes, boardsRes, tasksRes] = await Promise.all([
        supabase.from("users").select("id, created_at"),
        supabase.from("boards").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).is("deleted_at", null),
      ]);

      const users = usersRes.data ?? [];
      const totalBoards = boardsRes.count ?? 0;
      const totalTasks = tasksRes.count ?? 0;

      // Weekly signups (last 8 weeks)
      const weeklyMap = new Map<string, number>();
      for (const u of users) {
        if (!u.created_at) continue;
        const d = new Date(u.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + 1);
      }

      const weeklySignups = Array.from(weeklyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([week, count]) => ({ week, count }));

      setStats({
        totalUsers: users.length,
        totalBoards,
        totalTasks,
        weeklySignups,
      });

      // Fetch reports
      const { data: reportsData } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      const fetchedReports = (reportsData ?? []) as Report[];
      setReports(fetchedReports);

      // Initialize editing state
      const editState: Record<string, { status: string; decision_note: string }> = {};
      for (const r of fetchedReports) {
        editState[r.id] = {
          status: r.status ?? "open",
          decision_note: r.decision_note ?? "",
        };
      }
      setEditingReports(editState);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("admin-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // fallback
        // @ts-ignore
        channel.unsubscribe?.();
      }
    };
  }, [fetchData]);

  const handleSaveReport = async (reportId: string) => {
    const edits = editingReports[reportId];
    if (!edits) return;

    setSavingId(reportId);
    const { error } = await supabase
      .from("reports")
      .update({
        status: edits.status,
        decision_note: edits.decision_note,
        updated_at: new Date().toISOString(),
        admin_seen: true,
      })
      .eq("id", reportId);

    if (error) {
      console.error("Save report error:", error);
    } else {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: edits.status, decision_note: edits.decision_note }
            : r
        )
      );
    }
    setSavingId(null);
  };

  const maxSignup = Math.max(1, ...stats.weeklySignups.map((w) => w.count));

  const openCount = reports.filter((r) => !r.status || r.status === "open").length;
  const reviewCount = reports.filter((r) => r.status === "in_review").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_review" | "resolved">("all");
  const [sortField, setSortField] = useState<"created_at" | "updated_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredReports = useMemo(() => {
    let out = [...reports];
    if (statusFilter !== "all") {
      if (statusFilter === "open") {
        out = out.filter((r) => !r.status || r.status === "open");
      } else {
        out = out.filter((r) => (r.status ?? "open") === statusFilter);
      }
    }

    out.sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];

      // Convert to timestamps for comparison; handle nulls
      const aTime = aVal ? new Date(aVal).getTime() : 0;
      const bTime = bVal ? new Date(bVal).getTime() : 0;

      if (aTime === bTime) return 0;
      if (sortOrder === "asc") return aTime - bTime;
      return bTime - aTime;
    });

    return out;
  }, [reports, statusFilter, sortField, sortOrder]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">total</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-extrabold text-gray-900">{stats.totalUsers}</p>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">Registered Users</p>
        </div>

        {/* Total Boards */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">active</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-extrabold text-gray-900">{stats.totalBoards}</p>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">User Boards</p>
        </div>

        {/* Total Tasks */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">live</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-extrabold text-gray-900">{stats.totalTasks}</p>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">Total Tasks Created</p>
        </div>

        {/* Reports */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <svg className="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700">tickets</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-extrabold text-gray-900">{reports.length}</p>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">Board reports submitted</p>
        </div>
      </div>

      {/* Signup Growth */}
      <div className="rounded-3xl border border-gray-200/80 bg-white/80 p-8 backdrop-blur-sm shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-gray-900">Signup Growth</h2>
          <p className="text-sm font-medium text-gray-500">Trends over the last {stats.weeklySignups.length} weeks</p>
        </div>
        {stats.weeklySignups.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-400">No signup data yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {stats.weeklySignups.map((w) => (
              <div key={w.week} className="flex items-center gap-6">
                <span className="w-28 shrink-0 text-sm font-semibold text-gray-500">{w.week}</span>
                <div className="flex-1 rounded-full bg-gray-100/80 p-1">
                  <div
                    className="h-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm transition-all duration-500 ease-out"
                    style={{ width: `${(w.count / maxSignup) * 100}%`, minWidth: "24px" }}
                  />
                </div>
                <span className="w-20 text-right text-sm font-bold text-gray-700">
                  {w.count} <span className="text-xs font-medium text-gray-400">user{w.count !== 1 ? "s" : ""}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reports & Moderation */}
      <div id="admin-reports" className="rounded-3xl border border-gray-200/80 bg-white/80 p-8 backdrop-blur-sm shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Board Reports &amp; Moderation</h2>
            <p className="text-sm font-medium text-gray-500">Review issues reported from active boards</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-2 text-sm font-medium shadow-sm">
            <span className="flex items-center gap-2 px-2 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-sm" />
              {openCount} <span className="hidden sm:inline">Open</span>
            </span>
            <div className="h-4 w-px bg-gray-200" />
            <span className="flex items-center gap-2 px-2 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-sm" />
              {reviewCount} <span className="hidden sm:inline">Review</span>
            </span>
            <div className="h-4 w-px bg-gray-200" />
            <span className="flex items-center gap-2 px-2 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-sm" />
              {resolvedCount} <span className="hidden sm:inline">Resolved</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500">Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 outline-none"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </select>

            <label className="ml-3 text-sm text-gray-500">Sort by:</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 outline-none"
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
              className="ml-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
              title="Toggle sort order"
            >
              {sortOrder === "desc" ? "Desc" : "Asc"}
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-3">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-900">All caught up!</p>
            <p className="text-sm text-gray-500">No board reports requiring moderation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Reporter</th>
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Title</th>
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Message</th>
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Decision Note</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredReports.map((report) => {
                  const edits = editingReports[report.id];
                  return (
                    <tr key={report.id} className="group">
                      <td className="py-4 pr-4">
                        <span className="text-sm text-gray-700">{report.reporter_email}</span>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="text-sm font-semibold text-gray-900">{report.title}</span>
                      </td>
                      <td className="max-w-[200px] py-4 pr-4">
                        <span className="text-sm text-gray-600">{report.message}</span>
                      </td>
                      <td className="py-4 pr-4">
                        <select
                          value={edits?.status ?? "open"}
                          onChange={(e) =>
                            setEditingReports((prev) => ({
                              ...prev,
                              [report.id]: { ...prev[report.id], status: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s === "in_review" ? "In Review" : s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 pr-4">
                        <textarea
                          value={edits?.decision_note ?? ""}
                          onChange={(e) =>
                            setEditingReports((prev) => ({
                              ...prev,
                              [report.id]: { ...prev[report.id], decision_note: e.target.value },
                            }))
                          }
                          placeholder="Tambah catatan keputusan admin"
                          rows={2}
                          className="w-full min-w-[180px] resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleSaveReport(report.id)}
                          disabled={savingId === report.id}
                          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingId === report.id ? "..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
