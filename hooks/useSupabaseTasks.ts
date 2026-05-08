"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ColumnData, Task, Priority, TaskStatus, Board, COLUMNS_CONFIG } from "@/lib/data";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

interface DbTask {
  id: string;
  board_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  start_date: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

interface DbBoard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
}

interface DbUser {
  id: string;
  name: string;
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
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toTask(row: DbTask, assigneeName?: string): Task {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: (row.priority as Priority) ?? "Medium",
    dueDate: formatDate(row.due_date),
    dueDateRaw: row.due_date ?? "",
    startDateRaw: row.start_date ?? "",
    assigneeId: row.assignee_id,
    assigneeName: assigneeName ?? "Unassigned",
  };
}

export function useSupabaseTasks() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [columns, setColumns] = useState<ColumnData[]>(
    COLUMNS_CONFIG.map((c) => ({ ...c, tasks: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Board | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  // Fetch all user boards
  const fetchBoards = useCallback(async (): Promise<Board[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      logSupabaseError("Fetch boards error", error);
      return [];
    }

    if (!data) return [];

    return (data as DbBoard[]).map(dbBoard => ({
      id: dbBoard.id,
      name: dbBoard.name,
      description: dbBoard.description ?? "",
      ownerId: dbBoard.owner_id,
    }));
  }, [user]);

  // Fetch all tasks for the active board
  const fetchData = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);

    try {
      if (!user) {
        setColumns(COLUMNS_CONFIG.map((c) => ({ ...c, tasks: [] })));
        setBoard(null);
        setBoards([]);
        return;
      }

      // Get all boards first
      const allBoards = await fetchBoards();
      setBoards(allBoards);

      if (allBoards.length === 0) {
        setColumns(COLUMNS_CONFIG.map((c) => ({ ...c, tasks: [] })));
        setBoard(null);
        return;
      }

      // Determine active board
      let currentActiveId = localStorage.getItem("activeBoardId");
      if (!currentActiveId || !allBoards.find(b => b.id === currentActiveId)) {
        currentActiveId = allBoards[0].id;
        localStorage.setItem("activeBoardId", currentActiveId);
      }
      
      setActiveBoardId(currentActiveId);
      const activeBoard = allBoards.find(b => b.id === currentActiveId) || allBoards[0];
      setBoard(activeBoard);

      // Fetch tasks for this board
      const taskRes = await supabase
        .from("tasks")
        .select("*")
        .eq("board_id", activeBoard.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (taskRes.error) {
        logSupabaseError("Fetch tasks error", taskRes.error);
        return;
      }

      const dbTasks = taskRes.data as DbTask[];

      // Fetch assignee names for tasks that have assignee_id
      const assigneeIds = [
        ...new Set(dbTasks.map((t) => t.assignee_id).filter(Boolean)),
      ] as string[];

      let userMap: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, name")
          .in("id", assigneeIds);

        if (!usersError && users) {
          for (const u of users as DbUser[]) {
            userMap[u.id] = u.name;
          }
        }
      }

      // Map tasks into columns
      const mapped: ColumnData[] = COLUMNS_CONFIG.map((col) => ({
        ...col,
        tasks: dbTasks
          .filter((t) => t.status === col.id)
          .map((t) => toTask(t, t.assignee_id ? userMap[t.assignee_id] : undefined)),
      }));

      setColumns(mapped);
    } catch (error) {
      logSupabaseError("Fetch exception", error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, fetchBoards]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const switchBoard = (boardId: string) => {
    localStorage.setItem("activeBoardId", boardId);
    setActiveBoardId(boardId);
    fetchData(); // Refetch data for new board
  };

  const createBoard = async (name: string, description: string) => {
    if (!user) return false;

    const { data, error } = await supabase
      .from("boards")
      .insert({
        name,
        description,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      logSupabaseError("Create board error", error);
      return false;
    }

    if (data) {
      switchBoard(data.id);
      return true;
    }

    return false;
  };

  const addTask = useCallback(
    async (
      status: TaskStatus,
      task: {
        title: string;
        description: string;
        priority: Priority;
        dueDate: string;
        assigneeName: string;
      }
    ) => {
      if (!user || !board) {
        logSupabaseError("Insert error", { message: "User must be logged in" });
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          board_id: board.id,
          title: task.title,
          description: task.description,
          status: status,
          priority: task.priority,
          due_date: task.dueDate || null,
          assignee_id: null,
        })
        .select()
        .single();

      if (error) {
        logSupabaseError("Insert error", error);
        return;
      }

      const newTask = toTask(data as DbTask, task.assigneeName || undefined);
      setColumns((prev) =>
        prev.map((c) =>
          c.id === status ? { ...c, tasks: [...c.tasks, newTask] } : c
        )
      );
    },
    [board, user]
  );

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      if (!user) {
        logSupabaseError("Move error", { message: "User must be logged in" });
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) logSupabaseError("Move error", error);
    },
    [user]
  );

  const reorderTasks = useCallback(
    async (status: TaskStatus, tasks: Task[]) => {
      if (!user) {
        logSupabaseError("Reorder error", { message: "User must be logged in" });
        return;
      }

      // Update status for all tasks in this column
      for (const t of tasks) {
        const { error } = await supabase
          .from("tasks")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", t.id);

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

      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: updates.title.trim(),
          description: updates.description,
          priority: updates.priority,
          due_date: updates.dueDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) {
        logSupabaseError("Update error", error);
        return;
      }

      const updatedTask = toTask(data as DbTask, updates.assigneeName || undefined);
      setColumns((prev) =>
        prev.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
        }))
      );
    },
    [user]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user) {
        logSupabaseError("Delete error", { message: "User must be logged in" });
        return;
      }

      // Soft delete
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) {
        logSupabaseError("Delete error", error);
        return;
      }

      setColumns((prev) =>
        prev.map((column) => ({
          ...column,
          tasks: column.tasks.filter((task) => task.id !== taskId),
        }))
      );
    },
    [user]
  );

  return {
    columns,
    setColumns,
    loading,
    board,
    boards,
    activeBoardId,
    switchBoard,
    createBoard,
    addTask,
    reorderTasks,
    updateTask,
    deleteTask,
    moveTask,
    refetch: fetchData,
  };
}
