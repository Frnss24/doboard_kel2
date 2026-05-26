"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 120;
const DAY_WIDTH = 40;

const statusColors: Record<string, string> = {
  todo: "bg-blue-400",
  doing: "bg-orange-400",
  done: "bg-green-500",
};

function getDayOffset(dateStr: string, startDate: Date) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return NaN;
  const diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff) * DAY_WIDTH;
}

function isValidDateString(s: string | undefined | null) {
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

export default function TimelinePage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const { columns: initialColumns, loading, board, refetch } = useSupabaseTasks();
  const today = new Date();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/timeline");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // gather all valid due dates from tasks
  const allDates = initialColumns
    .flatMap((c) => c.tasks)
    .map((t) => (t as any).dueDateRaw || t.dueDate)
    .filter(Boolean)
    .map((s) => new Date(s as string))
    .filter((d) => !Number.isNaN(d.getTime()));

  // determine timeline start and end
  let startDate = new Date();
  startDate.setDate(1); // default to start of current month

  if (allDates.length > 0) {
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    // use start of the month of the earliest task for nicer grid
    startDate = new Date(min.getFullYear(), min.getMonth(), 1);
  }

  const maxDateCandidate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : today;
  // ensure endDate is at least today + 7 days
  const minEnd = new Date(today);
  minEnd.setDate(minEnd.getDate() + 7);
  const endDate = maxDateCandidate > minEnd ? maxDateCandidate : minEnd;

  // total days, with a cap
  const totalDays = Math.min(
    Math.max(DEFAULT_DAYS, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1),
    MAX_DAYS
  );

  const todayOffset = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;

  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="min-h-[calc(100vh-57px)] bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{board ? `${board.name} - Timeline` : "Timeline"}</h1>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-600 underline"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">Gantt view</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading tasks...</p>
      ) : (<>
      <div className="flex items-center gap-4 mb-4">
        {[["todo","To Do"],["doing","Doing"],["done","Done"]].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key]}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm shadow-sm overflow-x-auto">
        <div style={{ minWidth: `${200 + totalDays * DAY_WIDTH}px` }}>
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
              <div className="flex items-center gap-2 px-4 py-2 bg-white/50 border-b border-gray-100">
                <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.title}</span>
              </div>

              {col.tasks.map((task) => {
                const offsetSource = (task as any).dueDateRaw || task.dueDate;
                const startSource = (task as any).startDateRaw || null;
                const hasValidDate = isValidDateString(offsetSource);
                const hasValidStart = isValidDateString(startSource);
                return (
                <div key={task.id} className="flex border-b border-gray-50 hover:bg-gray-50/50">
                  <div className="w-48 shrink-0 px-4 py-3 flex items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${statusColors[col.id]}`}>
                      {task.assigneeName !== "Unassigned" ? task.assigneeName.slice(0, 1).toUpperCase() : "?"}
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
                    {hasValidDate ? (
                      hasValidStart ? (
                        (() => {
                          const startPx = getDayOffset(startSource as string, startDate);
                          const duePx = getDayOffset(offsetSource as string, startDate);
                          const leftPx = Math.min(startPx, duePx);
                          const widthPx = Math.max(DAY_WIDTH, Math.abs(duePx - startPx) + DAY_WIDTH);
                          return (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center px-3 gap-2 shadow-sm ${statusColors[col.id]}`}
                              style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                            >
                              <span className="text-xs font-medium text-white truncate">{task.title}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center px-3 gap-2 shadow-sm ${statusColors[col.id]}`}
                          style={{ left: `${getDayOffset(offsetSource, startDate) - DAY_WIDTH * 3}px`, width: `${DAY_WIDTH * 4}px` }}
                        >
                          <span className="text-xs font-medium text-white truncate">{task.title}</span>
                        </div>
                      )
                    ) : (
                      <div className="absolute top-1/2 -translate-y-1/2 h-8 flex items-center px-3 gap-2 text-xs text-gray-400">
                        No due date
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        🔵 Blue line marks today — {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
      </>)}
    </div>
  );
}