"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ColumnData, Task, Priority } from "@/lib/data";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

const COLUMN_META: Record<string, { color: string; dotColor: string }> = {
  todo: { color: "bg-blue-100 text-blue-700", dotColor: "bg-blue-500" },
  "in-progress": { color: "bg-orange-100 text-orange-700", dotColor: "bg-orange-400" },
  done: { color: "bg-green-100 text-green-700", dotColor: "bg-green-500" },
};

interface DbTask {
  id: string;
  user_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  assignee_name: string;
  assignee_avatar: string;
  position: number;
}

interface DbColumn {
  id: string;
  title: string;
  color: string;
  dot_color: string;
  position: number;
}

function formatSupabaseError(error: unknown) {
  if (!error) {
    return { message: "Unknown error" };
  }

  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  if (typeof error === "object") {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return {
      message: maybeError.message ?? "Unknown error",
      details: maybeError.details ?? null,
      hint: maybeError.hint ?? null,
      code: maybeError.code ?? null,
    };
  }

  return { message: String(error) };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: formatDate(row.due_date),
    assignee: { name: row.assignee_name, avatar: row.assignee_avatar },
  };
}

export function useSupabaseTasks() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);

    try {
      const colRes = await supabase.from("columns").select("*").order("position");

      if (colRes.error) {
        console.error("Supabase fetch error:", formatSupabaseError(colRes.error));
        setLoading(false);
        return;
      }

      let dbTasks: DbTask[] = [];

      if (user) {
        const taskRes = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("position");

        if (taskRes.error) {
          console.error("Supabase fetch error:", formatSupabaseError(taskRes.error));
          setLoading(false);
          return;
        }

        dbTasks = taskRes.data as DbTask[];
      }
      const dbColumns = colRes.data as DbColumn[];

      const mapped: ColumnData[] = dbColumns.map((col) => ({
        id: col.id,
        title: col.title,
        color: col.color ?? COLUMN_META[col.id]?.color ?? "",
        dotColor: col.dot_color ?? COLUMN_META[col.id]?.dotColor ?? "",
        tasks: dbTasks
          .filter((t) => t.column_id === col.id)
          .map(toTask),
      }));

      setColumns(mapped);
    } catch (error) {
      console.error("Supabase fetch exception:", formatSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTask = useCallback(
    async (
      columnId: string,
      task: {
        title: string;
        description: string;
        priority: Priority;
        dueDate: string;
        assigneeName: string;
      }
    ) => {
      if (!user) {
        console.error("Insert error:", { message: "User must be logged in" });
        return;
      }

      const col = columns.find((c) => c.id === columnId);
      const position = col ? col.tasks.length : 0;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          column_id: columnId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.dueDate || null,
          assignee_name: task.assigneeName || "Unassigned",
          assignee_avatar: (task.assigneeName || "U")[0].toUpperCase(),
          position,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", formatSupabaseError(error));
        return;
      }

      const newTask = toTask(data as DbTask);
      setColumns((prev) =>
        prev.map((c) =>
          c.id === columnId ? { ...c, tasks: [...c.tasks, newTask] } : c
        )
      );
    },
    [columns, user]
  );

  const moveTask = useCallback(
    async (taskId: string, newColumnId: string, newPosition: number) => {
      if (!user) {
        console.error("Move error:", { message: "User must be logged in" });
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ column_id: newColumnId, position: newPosition })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (error) console.error("Move error:", formatSupabaseError(error));
    },
    [user]
  );

  const reorderTasks = useCallback(
    async (columnId: string, tasks: Task[]) => {
      if (!user) {
        console.error("Reorder error:", { message: "User must be logged in" });
        return;
      }

      const updates = tasks.map((t, i) => ({
        id: t.id,
        column_id: columnId,
        position: i,
      }));

      for (const u of updates) {
        const { error } = await supabase
          .from("tasks")
          .update({ position: u.position, column_id: u.column_id })
          .eq("id", u.id)
          .eq("user_id", user.id);

        if (error) {
          console.error("Reorder error:", formatSupabaseError(error));
          break;
        }
      }
    },
    [user]
  );

  return { columns, setColumns, loading, addTask, moveTask, reorderTasks, refetch: fetchData };
}
