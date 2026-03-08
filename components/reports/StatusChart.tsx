"use client"

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"

export default function StatusChart({ data }: any) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Tasks by Status
      </h3>

      <ResponsiveContainer width="100%" height={220}>

        <BarChart data={data}>
          <XAxis dataKey="name"/>
          <Tooltip/>
          <Bar dataKey="value" fill="#6366f1" radius={6}/>
        </BarChart>

      </ResponsiveContainer>

    </div>
  )
}