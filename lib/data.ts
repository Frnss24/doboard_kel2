export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  boardId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  dueDateRaw?: string;
  startDateRaw?: string;
  assigneeId: string | null;
  assigneeName: string;
}

export interface ColumnData {
  id: TaskStatus;
  title: string;
  color: string;
  dotColor: string;
  tasks: Task[];
}

export interface Board {
  id: string;
  name: string;
  description: string;
  ownerId: string;
}

// Hardcoded column definitions based on task_status enum
export const COLUMNS_CONFIG: Omit<ColumnData, "tasks">[] = [
  {
    id: "todo",
    title: "To Do",
    color: "bg-blue-100 text-blue-700",
    dotColor: "bg-blue-500",
  },
  {
    id: "doing",
    title: "Doing",
    color: "bg-orange-100 text-orange-700",
    dotColor: "bg-orange-400",
  },
  {
    id: "done",
    title: "Done",
    color: "bg-green-100 text-green-700",
    dotColor: "bg-green-500",
  },
];
