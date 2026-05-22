"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ColumnData, Task, Priority, TaskStatus, Board, BoardMember, COLUMNS_CONFIG } from "@/lib/data";
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

interface RpcBoardMember {
  user_id: string;
  name: string | null;
  role: "owner" | "member";
}

interface RpcUserName {
  id: string;
  name: string | null;
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
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  // Fetch all user boards
  const fetchBoards = useCallback(async (): Promise<Board[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("boards")
      .select("*")
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

  const fetchBoardMembers = useCallback(async (boardId: string): Promise<BoardMember[]> => {
    const { data, error } = await supabase.rpc("get_board_members", {
      board_uuid: boardId,
    });

    if (error) {
      logSupabaseError("Fetch board members error", error);
      return [];
    }

    if (!data) return [];

    return (data as RpcBoardMember[]).map((row) => ({
      userId: row.user_id,
      name: row.name ?? "Unknown user",
      role: row.role,
    }));
  }, []);

  // Fetch all tasks for the active board
  const fetchData = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);

    try {
      if (!user) {
        setColumns(COLUMNS_CONFIG.map((c) => ({ ...c, tasks: [] })));
        setBoard(null);
        setBoards([]);
        setBoardMembers([]);
        return;
      }

      // Get all boards first
      const allBoards = await fetchBoards();
      setBoards(allBoards);

      if (allBoards.length === 0) {
        setColumns(COLUMNS_CONFIG.map((c) => ({ ...c, tasks: [] })));
        setBoard(null);
        setBoardMembers([]);
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
      setBoardMembers(await fetchBoardMembers(activeBoard.id));

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
        const { data: users, error: usersError } = await supabase.rpc("get_users_by_ids", {
          user_ids: assigneeIds,
        });

        if (!usersError && users) {
          for (const u of users as RpcUserName[]) {
            userMap[u.id] = u.name ?? "Unknown user";
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
  }, [authLoading, user, fetchBoards, fetchBoardMembers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime changes on tasks so different pages/components
  // using this hook stay in sync without manual refresh.
  useEffect(() => {
    if (!user) return;

    // create a channel for tasks changes
    const channel = supabase
      .channel("public:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          // refetch latest data when any change occurs
          fetchData();
        }
      )
      .subscribe();

    return () => {
      try {
        // unsubscribe/cleanup
        channel.unsubscribe();
      } catch (e) {
        // fallback: attempt to remove channel via client API
        try {
          // @ts-ignore
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user, fetchData]);

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
      await supabase.from("board_members").insert({
        board_id: data.id,
        user_id: user.id,
        role: "owner",
      });
      switchBoard(data.id);
      return true;
    }

    return false;
  };

  const updateBoard = async (boardId: string, updates: { name: string; description: string }) => {
    if (!user) return false;

    const { error } = await supabase
      .from("boards")
      .update({
        name: updates.name.trim(),
        description: updates.description.trim(),
      })
      .eq("id", boardId)
      .eq("owner_id", user.id);

    if (error) {
      logSupabaseError("Update board error", error);
      return false;
    }

    await fetchData();
    return true;
  };

  const addTask = useCallback(
    async (
      status: TaskStatus,
      task: {
        title: string;
        description: string;
        priority: Priority;
        dueDate: string;
        startDate?: string;
        assigneeName: string;
        assigneeUserId: string;
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
          start_date: task.startDate || null,
          assignee_id: task.assigneeUserId || null,
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
        startDate?: string;
        assigneeName: string;
        assigneeUserId: string;
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
          start_date: updates.startDate || null,
          assignee_id: updates.assigneeUserId || null,
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

  const createBoardShareToken = useCallback(async (boardId: string) => {
    if (!user) return null;

    const targetBoard = boards.find((item) => item.id === boardId);
    if (!targetBoard || targetBoard.ownerId !== user.id) return null;

    const { data: existing, error: existingError } = await supabase
      .from("board_shares")
      .select("token")
      .eq("board_id", boardId)
      .eq("created_by", user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingError) {
      logSupabaseError("Fetch board share error", existingError);
      return null;
    }

    if (existing?.token) {
      return existing.token;
    }

    const token = crypto.randomUUID();
    const { error } = await supabase.from("board_shares").insert({
      board_id: boardId,
      token,
      created_by: user.id,
    });

    if (error) {
      logSupabaseError("Create board share error", error);
      return null;
    }

    return token;
  }, [boards, user]);

  return {
    columns,
    setColumns,
    loading,
    board,
    boards,
    boardMembers,
    activeBoardId,
    switchBoard,
    createBoard,
    updateBoard,
    addTask,
    reorderTasks,
    updateTask,
    deleteTask,
    moveTask,
    createBoardShareToken,
    refetch: fetchData,
  };
}
