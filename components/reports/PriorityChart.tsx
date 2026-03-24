"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

interface PriorityItem {
  name: string
  value: number
  color: string
}

interface PriorityChartProps {
  data: PriorityItem[]
}

export default function PriorityChart({ data }: PriorityChartProps) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Priority Breakdown
      </h3>

      <ResponsiveContainer width="100%" height={220}>

        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            innerRadius={60}
            outerRadius={90}
          >

            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color}/>
            ))}

          </Pie>

        </PieChart>

      </ResponsiveContainer>

    </div>
  )
}