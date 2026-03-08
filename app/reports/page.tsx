"use client"

import { initialColumns } from "@/lib/data"

import StatsCard from "@/components/reports/StatsCard"
import StatusChart from "@/components/reports/StatusChart"
import PriorityChart from "@/components/reports/PriorityChart"
import WeeklyVelocity from "@/components/reports/WeeklyVelocity"
import RecentActivity from "@/components/reports/RecentActivity"

export default function ReportsPage() {

  const allTasks = initialColumns.flatMap(col => col.tasks)

  const totalTasks = allTasks.length

  const done =
    initialColumns.find(c => c.id === "done")?.tasks.length ?? 0

  const inProgress =
    initialColumns.find(c => c.id === "in-progress")?.tasks.length ?? 0

  const todo =
    initialColumns.find(c => c.id === "todo")?.tasks.length ?? 0

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

  const weeklyData = [
    {week:"Jan 12",added:3,completed:1},
    {week:"Jan 19",added:2,completed:2},
    {week:"Jan 26",added:4,completed:3},
    {week:"Feb 2",added:2,completed:2},
    {week:"Feb 9",added:3,completed:4},
    {week:"Feb 16",added:5,completed:3},
    {week:"Feb 23",added:4,completed:5},
    {week:"Mar 2",added:3,completed:4}
  ]

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
          <RecentActivity/>
        </div>

      </div>

    </div>

  )
}