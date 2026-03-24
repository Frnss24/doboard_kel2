export type Priority = "High" | "Medium" | "Low";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  dueDateRaw?: string;
  assignee: {
    name: string;
    avatar: string;
  };
}

export interface ColumnData {
  id: string;
  title: string;
  color: string;
  dotColor: string;
  tasks: Task[];
}
