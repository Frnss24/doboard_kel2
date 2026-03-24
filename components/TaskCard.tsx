"use client";

import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/lib/data";

const priorityStyles: Record<string, string> = {
  High: "bg-red-50 text-red-600 border border-red-200",
  Medium: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  Low: "bg-green-50 text-green-600 border border-green-200",
};

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  draggable?: boolean;
}

interface TaskCardBodyProps {
  task: Task;
  isDragging?: boolean;
  onClick?: (task: Task) => void;
  dragHandle?: ReactNode;
}

function TaskCardBody({ task, isDragging = false, onClick, dragHandle }: TaskCardBodyProps) {
  return (
    <div
      onClick={() => onClick?.(task)}
      className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      } ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
        {dragHandle}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{task.description}</p>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>
        <span className="text-xs text-gray-400">{task.dueDate}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-[10px] font-bold text-white">
          {task.assignee.avatar}
        </div>
        <span className="text-xs text-gray-500">{task.assignee.name}</span>
      </div>
    </div>
  );
}

export default function TaskCard({ task, onClick, draggable = true }: TaskCardProps) {
  if (!draggable) {
    return <TaskCardBody task={task} />;
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardBody
        task={task}
        isDragging={isDragging}
        onClick={onClick}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            className="cursor-grab rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
            aria-label="Drag task"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 12h16M4 16h16" />
            </svg>
          </button>
        }
      />
    </div>
  );
}
