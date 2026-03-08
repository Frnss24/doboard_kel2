"use client";

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
}

export default function TaskCard({ task }: TaskCardProps) {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        {task.description}
      </p>

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
