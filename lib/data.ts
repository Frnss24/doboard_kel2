export type Priority = "High" | "Medium" | "Low";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
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

export const initialColumns: ColumnData[] = [
  {
    id: "todo",
    title: "To Do",
    color: "bg-blue-100 text-blue-700",
    dotColor: "bg-blue-500",
    tasks: [
      {
        id: "task-1",
        title: "Design System Updates",
        description: "Update color palette and typography scales for the new brand guidelines",
        priority: "High",
        dueDate: "Mar 15, 2026",
        assignee: { name: "Alice", avatar: "A" },
      },
      {
        id: "task-2",
        title: "API Integration",
        description: "Connect the frontend with the new REST API endpoints",
        priority: "Medium",
        dueDate: "Mar 20, 2026",
        assignee: { name: "Bob", avatar: "B" },
      },
      {
        id: "task-3",
        title: "User Research",
        description: "Conduct user interviews for the onboarding flow redesign",
        priority: "Low",
        dueDate: "Mar 25, 2026",
        assignee: { name: "Carol", avatar: "C" },
      },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    color: "bg-orange-100 text-orange-700",
    dotColor: "bg-orange-400",
    tasks: [
      {
        id: "task-4",
        title: "Dashboard Redesign",
        description: "Implement the new dashboard layout with analytics widgets",
        priority: "High",
        dueDate: "Mar 12, 2026",
        assignee: { name: "Dave", avatar: "D" },
      },
      {
        id: "task-5",
        title: "Authentication Flow",
        description: "Add OAuth2 login with Google and GitHub providers",
        priority: "Medium",
        dueDate: "Mar 18, 2026",
        assignee: { name: "Eve", avatar: "E" },
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    color: "bg-green-100 text-green-700",
    dotColor: "bg-green-500",
    tasks: [
      {
        id: "task-6",
        title: "Project Setup",
        description: "Initialize the Next.js project with Tailwind CSS and TypeScript",
        priority: "Low",
        dueDate: "Mar 5, 2026",
        assignee: { name: "Frank", avatar: "F" },
      },
      {
        id: "task-7",
        title: "Database Schema",
        description: "Design and implement the Supabase database schema",
        priority: "High",
        dueDate: "Mar 8, 2026",
        assignee: { name: "Grace", avatar: "G" },
      },
    ],
  },
];
