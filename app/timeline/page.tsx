"use client";
import { initialColumns } from "@/lib/data";

const DAYS = 30;
const DAY_WIDTH = 40;
const START_DATE = new Date("2026-03-01");

const statusColors: Record<string, string> = {
  todo: "bg-blue-400",
  "in-progress": "bg-orange-400",
  done: "bg-green-500",
};

function getDayOffset(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Math.floor((date.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff) * DAY_WIDTH;
}

export default function TimelinePage() {
  const today = new Date();
  const todayOffset = Math.floor((today.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">Gantt view</p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        {[["todo","To Do"],["in-progress","In Progress"],["done","Done"]].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key]}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <div style={{ minWidth: `${200 + DAYS * DAY_WIDTH}px` }}>
          <div className="flex border-b border-gray-100">
            <div className="w-48 shrink-0 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Task</div>
            <div className="flex">
              {days.map((d, i) => (
                <div key={i} style={{ width: DAY_WIDTH }} className={`text-center py-3 text-xs font-medium border-l border-gray-50 ${d.toDateString() === today.toDateString() ? "text-blue-600 font-bold" : "text-gray-400"}`}>
                  {d.getDate()}
                </div>
              ))}
            </div>
          </div>

          {initialColumns.map((col) => (
            <div key={col.id}>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.title}</span>
              </div>

              {col.tasks.map((task) => (
                <div key={task.id} className="flex border-b border-gray-50 hover:bg-gray-50/50">
                  <div className="w-48 shrink-0 px-4 py-3 flex items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${statusColors[col.id]}`}>
                      {task.assignee.avatar}
                    </div>
                    <span className="text-xs text-gray-700 truncate">{task.title}</span>
                  </div>
                  <div className="relative flex-1 h-12">
                    {todayOffset >= 0 && (
                      <div className="absolute top-0 bottom-0 w-px bg-blue-400 z-10" style={{ left: `${todayOffset}px` }} />
                    )}
                    {days.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-50" style={{ left: `${i * DAY_WIDTH}px` }} />
                    ))}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center px-3 gap-2 shadow-sm ${statusColors[col.id]}`}
                      style={{ left: `${getDayOffset(task.dueDate) - DAY_WIDTH * 3}px`, width: `${DAY_WIDTH * 4}px` }}
                    >
                      <span className="text-xs font-medium text-white truncate">{task.title}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        🔵 Blue line marks today — {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}