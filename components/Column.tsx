"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import { ColumnData, Task } from "@/lib/data";

interface ColumnProps {
  column: ColumnData;
  onAddTask: (columnId: string) => void;
  onTaskClick: (task: Task) => void;
  disableDrag?: boolean;
  emptyMessage?: string;
}

export default function Column({
  column,
  onAddTask,
  onTaskClick,
  disableDrag = false,
  emptyMessage = "No tasks yet",
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="animate-fade-up flex min-w-[300px] flex-1 flex-col">
      {/* Column Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
          <h2 className="text-sm font-semibold text-gray-800">
            {column.title}
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.color}`}>
            {column.tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Cards Container */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white/70 p-3 shadow-sm backdrop-blur-sm transition ${
          isOver && !disableDrag ? "bg-blue-50/60 ring-2 ring-blue-200" : ""
        }`}
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.length > 0 ? (
            column.tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={onTaskClick} draggable={!disableDrag} />
            ))
          ) : (
            <button
              onClick={() => onAddTask(column.id)}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-12 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm">{emptyMessage}</span>
              <span className="text-xs font-medium text-blue-500">Add a task</span>
            </button>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
