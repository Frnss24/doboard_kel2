"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

export default function PriorityChart({ data }: any) {

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

            {data.map((entry:any, index:number) => (
              <Cell key={index} fill={entry.color}/>
            ))}

          </Pie>

        </PieChart>

      </ResponsiveContainer>

    </div>
  )
}