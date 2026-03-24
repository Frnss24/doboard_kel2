"use client"

import { useSupabaseTasks } from "@/hooks/useSupabaseTasks"
import { Task } from "@/lib/data"

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

  const { columns, loading } = useSupabaseTasks()

  const allTasks = columns.flatMap(col => col.tasks)

  const totalTasks = allTasks.length

  const done =
    columns.find(c => c.id === "done")?.tasks.length ?? 0

  const inProgress =
    columns.find(c => c.id === "in-progress")?.tasks.length ?? 0

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
    {name:"In Progress",value:inProgress},
    {name:"Done",value:done}
  ]

  const weeklyData = buildWeeklyVelocity(columns)
  const recentActivities = buildRecentActivities(columns)

  return (

    <div className="flex min-h-[calc(100vh-57px)] flex-col bg-gray-50">

      <div className="border-b border-gray-200 bg-white px-6 py-4">

        <h1 className="text-xl font-bold text-gray-900">
          Reports
        </h1>

        <p className="text-sm text-gray-500">
          Project analytics · March 2026
        </p>

      </div>

      <div className="p-6 space-y-6">

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