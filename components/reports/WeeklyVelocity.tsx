"use client"

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

export default function WeeklyVelocity({ data }: any) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Weekly Velocity
      </h3>

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

    </div>
  )
}