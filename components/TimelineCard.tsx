import { Task } from "@/lib/data";

interface TimelineCardProps {
  task: Task;
  startOffset: number;
  width: number;
  columnId: string;
}

const statusColors: Record<string, string> = {
  todo: "bg-blue-400",
  "in-progress": "bg-orange-400",
  done: "bg-green-500",
};

const priorityColors: Record<string, string> = {
  High: "bg-red-50 text-red-600 border border-red-200",
  Medium: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  Low: "bg-green-50 text-green-600 border border-green-200",
};

export default function TimelineCard({ task, startOffset, width, columnId }: TimelineCardProps) {
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center px-3 gap-2 shadow-sm cursor-pointer hover:brightness-95 transition ${statusColors[columnId]}`}
      style={{ left: `${startOffset}px`, width: `${width}px` }}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/30 text-[10px] font-bold text-white">
        {task.assignee.avatar}
      </div>
      <span className="text-xs font-medium text-white truncate">
        {task.title}
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColors[task.priority]}`}>
        {task.priority}
      </span>
    </div>
  );
}