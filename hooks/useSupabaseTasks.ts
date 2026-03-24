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
    const base = error as Error & {
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
    };

    return {
      name: base.name,
      message: base.message || "Unknown error",
      details: base.details ?? null,
      hint: base.hint ?? null,
      code: base.code ?? null,
      status: base.status ?? null,
      stack: base.stack ?? null,
    };
  }

  if (typeof error === "object") {
    const maybeError = error as {
      name?: string;
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
      error_description?: string;
      error?: string;
    };

    const objectKeys = Object.getOwnPropertyNames(error);

    let serialized: string | null = null;
    try {
      serialized = JSON.stringify(error);
    } catch {
      serialized = null;
    }

    return {
      name: maybeError.name ?? null,
      message:
        maybeError.message ??
        maybeError.error_description ??
        maybeError.error ??
        "Unknown error",
      details: maybeError.details ?? null,
      hint: maybeError.hint ?? null,
      code: maybeError.code ?? null,
      status: maybeError.status ?? null,
      keys: objectKeys,
      serialized,
    };
  }

  return { message: String(error) };
}

function logSupabaseError(label: string, error: unknown) {
  const parsed = formatSupabaseError(error);
  console.error(`${label}: ${parsed.message}`, parsed);

  // Common migration mistake: tasks.user_id column not created yet.
  const messageText = String(parsed.message || "").toLowerCase();
  if (messageText.includes("user_id") && (messageText.includes("column") || messageText.includes("does not exist"))) {
    console.error(
      "Schema hint: add tasks.user_id in Supabase SQL Editor -> alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;"
    );
  }
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
    dueDateRaw: row.due_date ?? "",
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
        logSupabaseError("Supabase fetch error", colRes.error);
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
          logSupabaseError("Supabase fetch error", taskRes.error);
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
      logSupabaseError("Supabase fetch exception", error);
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
        logSupabaseError("Insert error", { message: "User must be logged in" });
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
        logSupabaseError("Insert error", error);
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
        logSupabaseError("Move error", { message: "User must be logged in" });
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ column_id: newColumnId, position: newPosition })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (error) logSupabaseError("Move error", error);
    },
    [user]
  );

  const reorderTasks = useCallback(
    async (columnId: string, tasks: Task[]) => {
      if (!user) {
        logSupabaseError("Reorder error", { message: "User must be logged in" });
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
          logSupabaseError("Reorder error", error);
          break;
        }
      }
    },
    [user]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: {
        title: string;
        description: string;
        priority: Priority;
        dueDate: string;
        assigneeName: string;
      }
    ) => {
      if (!user) {
        logSupabaseError("Update error", { message: "User must be logged in" });
        return;
      }

      const cleanAssignee = updates.assigneeName.trim() || "Unassigned";

      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: updates.title.trim(),
          description: updates.description,
          priority: updates.priority,
          due_date: updates.dueDate || null,
          assignee_name: cleanAssignee,
          assignee_avatar: cleanAssignee[0].toUpperCase(),
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        logSupabaseError("Update error", error);
        return;
      }

      const updatedTask = toTask(data as DbTask);
      setColumns((prev) =>
        prev.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
        }))
      );
    },
    [user]
  );

  return {
    columns,
    setColumns,
    loading,
    addTask,
    moveTask,
    reorderTasks,
    updateTask,
    refetch: fetchData,
  };
}
