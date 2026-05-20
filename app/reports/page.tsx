"use client"

import { useSupabaseTasks } from "@/hooks/useSupabaseTasks"
import { Task } from "@/lib/data"
import { useReportNotifications } from "@/hooks/useReportNotifications"

import StatsCard from "@/components/reports/StatsCard"
import StatusChart from "@/components/reports/StatusChart"
import PriorityChart from "@/components/reports/PriorityChart"
import WeeklyVelocity from "@/components/reports/WeeklyVelocity"
import RecentActivity from "@/components/reports/RecentActivity"

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildWeeklyVelocity(columns: { id: string; tasks: Task[] }[]) {
  const buckets = new Map<string, { week: string; added: number; completed: number }>()

  const ensureBucket = (weekStart: Date) => {
    const key = weekStart.toISOString().slice(0, 10)
    if (!buckets.has(key)) {
      buckets.set(key, {
        week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        added: 0,
        completed: 0,
      })
    }
    return buckets.get(key)!
  }

  for (const column of columns) {
    for (const task of column.tasks) {
      if (!task.dueDateRaw) continue
      const due = new Date(task.dueDateRaw)
      if (Number.isNaN(due.getTime())) continue

      const bucket = ensureBucket(getWeekStart(due))
      bucket.added += 1
      if (column.id === "done") {
        bucket.completed += 1
      }
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([, value]) => value)
}

function buildRecentActivities(columns: { id: string; title: string; tasks: Task[] }[]) {
  return columns
    .flatMap((column) =>
      column.tasks.map((task) => ({
        text: `${task.title} · ${column.title}`,
        sortDate: task.dueDateRaw ? new Date(task.dueDateRaw).getTime() : 0,
      }))
    )
    .sort((a, b) => b.sortDate - a.sortDate)
    .slice(0, 6)
    .map((item) => item.text)
}

export default function ReportsPage() {

  const { columns, loading, board } = useSupabaseTasks()
  const { loading: reportLoading, responses } = useReportNotifications()

  const allTasks = columns.flatMap(col => col.tasks)

  const totalTasks = allTasks.length

  const done =
    columns.find(c => c.id === "done")?.tasks.length ?? 0

  const inProgress =
    columns.find(c => c.id === "doing")?.tasks.length ?? 0

  const todo =
    columns.find(c => c.id === "todo")?.tasks.length ?? 0

  const priorityData = [
    {
      name:"High",
      value:allTasks.filter(t=>t.priority==="High").length,
      color:"#ef4444"
    },
    {
      name:"Medium",
      value:allTasks.filter(t=>t.priority==="Medium").length,
      color:"#f59e0b"
    },
    {
      name:"Low",
      value:allTasks.filter(t=>t.priority==="Low").length,
      color:"#22c55e"
    }
  ]

  const statusData = [
    {name:"To Do",value:todo},
    {name:"Doing",value:inProgress},
    {name:"Done",value:done}
  ]

  const weeklyData = buildWeeklyVelocity(columns)
  const recentActivities = buildRecentActivities(columns)

  return (

    <div className="flex min-h-[calc(100vh-57px)] flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">

      <div className="border-b border-gray-200/80 bg-white/80 backdrop-blur-sm px-6 py-4">

        <h1 className="text-xl font-bold text-gray-900">
          {board ? `${board.name} - Reports` : "Reports"}
        </h1>

        <p className="text-sm text-gray-500">
          Project analytics · March 2026
        </p>

      </div>

      <div className="p-6 space-y-6">

        <section id="admin-responses" className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Admin responses
              </p>
              <h2 className="text-xl font-bold text-slate-900">Notifikasi tanggapan admin</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Di sini kamu bisa lihat balasan admin untuk report yang kamu kirim.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
              {reportLoading ? "Memuat notifikasi..." : `${responses.length} tanggapan ditemukan`}
            </div>
          </div>

          <div className="mt-5">
            {reportLoading ? (
              <p className="text-sm text-slate-500">Memeriksa report kamu...</p>
            ) : responses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 p-5 text-sm text-slate-600">
                Belum ada tanggapan admin untuk report kamu. Nanti kalau admin sudah membalas, notifikasi akan muncul di sini dan di ikon notifikasi.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {responses.slice(0, 4).map((report) => (
                  <article key={report.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(report.updated_at ?? report.created_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${report.status === "resolved" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                        {report.status === "resolved" ? "Resolved" : report.status === "in_review" ? "In Review" : "Open"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{report.decision_note?.trim() || "Admin sudah memberi tanggapan atas report ini."}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <p className="text-sm text-gray-400">Loading reports...</p>
        ) : (<>
        <div className="grid grid-cols-4 gap-4">
          <StatsCard title="Total Tasks" value={totalTasks}/>
          <StatsCard title="Completed" value={done}/>
          <StatsCard title="In Progress" value={inProgress}/>
          <StatsCard title="Overdue" value="0"/>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatusChart data={statusData}/>
          <PriorityChart data={priorityData}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <WeeklyVelocity data={weeklyData}/>
          <RecentActivity activities={recentActivities}/>
        </div>

        </>)}
      </div>

    </div>

  )
}