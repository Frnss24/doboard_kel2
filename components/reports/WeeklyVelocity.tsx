"use client"

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

interface WeeklyVelocityItem {
  week: string
  added: number
  completed: number
}

interface WeeklyVelocityProps {
  data: WeeklyVelocityItem[]
}

export default function WeeklyVelocity({ data }: WeeklyVelocityProps) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Weekly Velocity
      </h3>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>

          <LineChart data={data}>

            <XAxis dataKey="week"/>
            <Tooltip/>

            <Line
              dataKey="added"
              stroke="#6366f1"
              strokeWidth={3}
            />

            <Line
              dataKey="completed"
              stroke="#10b981"
              strokeWidth={3}
            />

          </LineChart>

        </ResponsiveContainer>
      ) : (
        <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
          Belum ada data mingguan dari task milik kamu.
        </div>
      )}

    </div>
  )
}