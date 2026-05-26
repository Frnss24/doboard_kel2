"use client";

import { useState, useCallback, useId, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import Column from "./Column";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import TaskDetailModal from "./TaskDetailModal";
import ReportIssueModal, { ReportCategory } from "./ReportIssueModal";
import { Task, Priority, TaskStatus } from "@/lib/data";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/lib/supabase";

type HeaderIconButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
  tone?: "default" | "primary";
};

function HeaderIconButton({ label, onClick, children, className = "", badge, tone = "default" }: HeaderIconButtonProps) {
  const innerToneClass =
    tone === "primary"
      ? "bg-white/15 text-white group-hover:bg-white/25"
      : "bg-slate-100 text-slate-600 group-hover:bg-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${innerToneClass}`}>
        {children}
      </span>
      {badge && (
        <span className="absolute -right-1 -top-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100">
          {badge}
        </span>
      )}
      <span className="pointer-events-none absolute -bottom-11 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default function Board() {
  const router = useRouter();
  const { 
    columns, setColumns, loading, board, boards, boardMembers, activeBoardId, 
    switchBoard, createBoard, updateBoard, addTask, reorderTasks, updateTask, deleteTask, createBoardShareToken
  } = useSupabaseTasks();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState<TaskStatus>("todo");
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isBoardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [createBoardError, setCreateBoardError] = useState<string | null>(null);
  const [editBoardOpen, setEditBoardOpen] = useState(false);
  const [editBoardName, setEditBoardName] = useState("");
  const [editBoardDescription, setEditBoardDescription] = useState("");
  const [editingBoard, setEditingBoard] = useState(false);
  const [editBoardError, setEditBoardError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBoardDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const doneTasks = columns.find((c) => c.id === "done")?.tasks.length ?? 0;
  const baseProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const hasActiveFilters = searchQuery.trim().length > 0 || priorityFilter !== "All";
  const isOwner = !!user && !!board && board.ownerId === user.id;

  const visibleColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => {
        const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;

        if (!query) {
          return matchesPriority;
        }

        const haystack = [
          task.title,
          task.description,
          task.assigneeName,
          task.priority,
          task.dueDate,
        ]
          .join(" ")
          .toLowerCase();

        return matchesPriority && haystack.includes(query);
      }),
    }));
  }, [columns, priorityFilter, searchQuery]);

  const currentTotalTasks = visibleColumns.reduce((sum, col) => sum + col.tasks.length, 0);
  const currentDoneTasks = visibleColumns.find((c) => c.id === "done")?.tasks.length ?? 0;
  const currentProgress =
    currentTotalTasks > 0 ? Math.round((currentDoneTasks / currentTotalTasks) * 100) : 0;
  const hasVisibleTasks = currentTotalTasks > 0;

  const findColumn = useCallback(
    (taskId: string) => {
      const col = columns.find((c) => c.id === taskId);
      if (col) return col;
      return columns.find((c) => c.tasks.some((t) => t.id === taskId));
    },
    [columns]
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (hasActiveFilters || viewMode !== "kanban") return;

    if (authLoading || !user) {
      setActiveTask(null);
      setActiveColumnId(null);
      if (!authLoading) {
        setAuthNotice("Login dulu untuk memindahkan task.");
      }
      return;
    }

    const { active } = event;
    const column = findColumn(active.id as string);
    const task = column?.tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
    setActiveColumnId(column?.id ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (hasActiveFilters || viewMode !== "kanban") return;
    if (authLoading || !user) return;

    const { active, over } = event;
    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);
    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    setColumns((prev) => {
      const activeColIndex = prev.findIndex((c) => c.id === activeColumn.id);
      const overColIndex = prev.findIndex((c) => c.id === overColumn.id);
      const activeTaskIndex = prev[activeColIndex].tasks.findIndex((t) => t.id === active.id);
      const task = prev[activeColIndex].tasks[activeTaskIndex];

      const newColumns = [...prev];
      newColumns[activeColIndex] = {
        ...newColumns[activeColIndex],
        tasks: newColumns[activeColIndex].tasks.filter((t) => t.id !== active.id),
      };

      const overTaskIndex = newColumns[overColIndex].tasks.findIndex((t) => t.id === over.id);
      const insertIndex =
        overTaskIndex >= 0 ? overTaskIndex : newColumns[overColIndex].tasks.length;

      newColumns[overColIndex] = {
        ...newColumns[overColIndex],
        tasks: [
          ...newColumns[overColIndex].tasks.slice(0, insertIndex),
          task,
          ...newColumns[overColIndex].tasks.slice(insertIndex),
        ],
      };

      return newColumns;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (hasActiveFilters || viewMode !== "kanban") {
      setActiveTask(null);
      setActiveColumnId(null);
      return;
    }

    if (authLoading || !user) {
      setActiveTask(null);
      setActiveColumnId(null);
      if (!authLoading) {
        setAuthNotice("Login dulu untuk memindahkan task.");
      }
      return;
    }

    const { active, over } = event;
    setActiveTask(null);

    if (!over || !activeColumnId) {
      setActiveColumnId(null);
      return;
    }

    const overColumnById = columns.find((c) => c.id === (over.id as string));
    const overColumn = overColumnById ?? findColumn(over.id as string);
    const activeColumn =
      columns.find((c) => c.id === activeColumnId) ?? findColumn(active.id as string);

    if (!activeColumn || !overColumn) {
      setActiveColumnId(null);
      return;
    }

    if (activeColumnId === overColumn.id) {
      const colIndex = columns.findIndex((c) => c.id === activeColumn.id);
      const oldIndex = columns[colIndex].tasks.findIndex((t) => t.id === active.id);
      const newIndex = columns[colIndex].tasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== newIndex && newIndex >= 0) {
        setColumns((prev) => {
          const newColumns = [...prev];
          newColumns[colIndex] = {
            ...newColumns[colIndex],
            tasks: arrayMove(newColumns[colIndex].tasks, oldIndex, newIndex),
          };
          reorderTasks(newColumns[colIndex].id, newColumns[colIndex].tasks);
          return newColumns;
        });
      }
    } else {
      setColumns((prev) => {
        const sourceColIndex = prev.findIndex((c) => c.id === activeColumnId);
        const targetColIndex = prev.findIndex((c) => c.id === overColumn.id);

        if (sourceColIndex < 0 || targetColIndex < 0) return prev;

        const sourceCol = prev[sourceColIndex];
        const targetCol = prev[targetColIndex];

        const movedTask =
          sourceCol.tasks.find((t) => t.id === active.id) ??
          targetCol.tasks.find((t) => t.id === active.id);
        if (!movedTask) return prev;

        const nextSourceTasks = sourceCol.tasks.filter((t) => t.id !== active.id);
        const nextTargetBase = targetCol.tasks.filter((t) => t.id !== active.id);
        const overTaskIndex = nextTargetBase.findIndex((t) => t.id === over.id);
        const insertIndex = overTaskIndex >= 0 ? overTaskIndex : nextTargetBase.length;

        const nextTargetTasks = [
          ...nextTargetBase.slice(0, insertIndex),
          movedTask,
          ...nextTargetBase.slice(insertIndex),
        ];

        const newColumns = [...prev];
        newColumns[sourceColIndex] = { ...sourceCol, tasks: nextSourceTasks };
        newColumns[targetColIndex] = { ...targetCol, tasks: nextTargetTasks };

        reorderTasks(newColumns[sourceColIndex].id, newColumns[sourceColIndex].tasks);
        reorderTasks(newColumns[targetColIndex].id, newColumns[targetColIndex].tasks);

        return newColumns;
      });
    }

    setActiveColumnId(null);
  };

  const handleAddTask = useCallback(
    async (task: {
      title: string;
      description: string;
      priority: Priority;
      dueDate: string;
      startDate?: string;
      assigneeName: string;
      assigneeUserId: string;
    }) => {
      if (!user) {
        setAuthNotice("Kamu harus login dulu sebelum menambah task.");
        router.push("/login?next=/board");
        return;
      }

      await addTask(modalColumnId, task);
      setAuthNotice(null);
    },
    [modalColumnId, addTask, router, user]
  );

  const openModal = (columnId: string) => {
    if (authLoading) return;

    if (!user) {
      setAuthNotice("Kamu harus register/login dulu sebelum membuat task.");
      router.push("/login?next=/board");
      return;
    }

    setAuthNotice(null);
    setModalColumnId(columnId as TaskStatus);
    setModalOpen(true);
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  };

  const selectedTaskView = selectedTask
    ? columns.flatMap((column) => column.tasks).find((task) => task.id === selectedTask.id) ??
      selectedTask
    : null;
  const selectedColumn = selectedTaskView ? findColumn(selectedTaskView.id) : null;

  const handleUpdateTask = useCallback(
    async (task: {
      title: string;
      description: string;
      priority: Priority;
      dueDate: string;
      startDate?: string;
      assigneeName: string;
      assigneeUserId: string;
    }) => {
      if (!selectedTask) return;

      await updateTask(selectedTask.id, task);
      setTaskDetailOpen(false);
    },
    [selectedTask, updateTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId);
      setTaskDetailOpen(false);
    },
    [deleteTask]
  );

  const handleSubmitReport = async (payload: {
    category: ReportCategory;
    title: string;
    message: string;
  }) => {
    if (!user) {
      setReportError("Kamu harus login dulu untuk mengirim report.");
      return;
    }

    setReportSubmitting(true);
    setReportError(null);

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reporter_email: user.email,
      title: payload.title,
      message: `[${payload.category}] ${payload.message}`,
      status: "open",
    });

    setReportSubmitting(false);

    if (error) {
      setReportError(error.message);
      return;
    }

    setReportOpen(false);
  };

  const handleCreateBoard = async (event: React.FormEvent) => {
    event.preventDefault();

    const name = newBoardName.trim();
    if (!name) {
      setCreateBoardError("Board name is required.");
      return;
    }

    setCreatingBoard(true);
    setCreateBoardError(null);

    const created = await createBoard(name, newBoardDescription.trim() || "User created board");

    setCreatingBoard(false);

    if (!created) {
      setCreateBoardError("Failed to create board. Please try again.");
      return;
    }

    setNewBoardName("");
    setNewBoardDescription("");
    setCreateBoardOpen(false);
  };

  const openEditBoard = () => {
    if (!board || !isOwner) return;

    setEditBoardName(board.name);
    setEditBoardDescription(board.description || "");
    setEditBoardError(null);
    setEditBoardOpen(true);
  };

  const handleEditBoard = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!board) return;

    const name = editBoardName.trim();
    if (!name) {
      setEditBoardError("Board name is required.");
      return;
    }

    setEditingBoard(true);
    setEditBoardError(null);

    const success = await updateBoard(board.id, {
      name,
      description: editBoardDescription.trim() || "No description",
    });

    setEditingBoard(false);

    if (!success) {
      setEditBoardError("Failed to update board. Please try again.");
      return;
    }

    setEditBoardOpen(false);
  };

  const handleOpenShare = async () => {
    if (!board || !isOwner) return;

    setShareOpen(true);
    setShareLoading(true);
    setShareError(null);
    setShareCopied(false);

    const token = await createBoardShareToken(board.id);
    if (!token) {
      setShareError("Gagal membuat link share.");
      setShareLoading(false);
      return;
    }

    setShareLink(`${window.location.origin}/share/${token}`);
    setShareLoading(false);
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
    } catch {
      setShareError("Tidak bisa menyalin link. Salin manual dari kolom di bawah.");
    }
  };

  const memberBadgeLabel = boardMembers.length === 1 ? "1 member" : `${boardMembers.length} members`;

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {boards && boards.length > 0 ? (
                <div className="flex w-full max-w-[22rem] flex-col" ref={dropdownRef}>
                  <button
                    onClick={() => setBoardDropdownOpen(!isBoardDropdownOpen)}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 text-sm font-bold text-white shadow-sm">
                      {(board?.name?.slice(0, 1) || "D").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Workspace
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-xl font-bold tracking-tight text-slate-900">
                          {board ? board.name : "DoBOARD"}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {boards.length}
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isBoardDropdownOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isBoardDropdownOpen && (
                    <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Your Boards
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Switch workspace or create a new one.
                            </p>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                            {boards.length}
                          </div>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                        {boards.map((b) => {
                          const isActive = activeBoardId === b.id;

                          return (
                            <button
                              key={b.id}
                              onClick={() => {
                                switchBoard(b.id);
                                setBoardDropdownOpen(false);
                              }}
                              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${isActive ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                            >
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${isActive ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700"}`}>
                                {(b.name?.slice(0, 1) || "B").toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-slate-900">
                                    {b.name}
                                  </span>
                                  {isActive && (
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 ring-1 ring-blue-100">
                                      Active
                                    </span>
                                  )}
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${b.ownerId === user?.id ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>
                                    {b.ownerId === user?.id ? "Owned" : "Shared"}
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {b.description || "No description"}
                                </p>
                              </div>
                              {isActive ? (
                                <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}

                        <div className="mt-2 border-t border-slate-100 px-2 pt-2">
                          <button
                            onClick={() => {
                              setBoardDropdownOpen(false);
                              setCreateBoardError(null);
                              setCreateBoardOpen(true);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-3 text-left text-sm font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                            </span>
                            <span className="flex-1">Create New Board</span>
                            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <h1 className="text-xl font-bold tracking-tight text-gray-900">
                  {board ? board.name : "DoBOARD"}
                </h1>
              )}

              {board && isOwner && (
                <div className="flex flex-wrap items-center gap-2">
                  <HeaderIconButton label="Edit Board" onClick={openEditBoard}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.5 20.213 3 21l.787-4.5 13.075-12.013z" />
                    </svg>
                  </HeaderIconButton>
                  <HeaderIconButton
                    label="Members"
                    onClick={() => setMembersOpen(true)}
                    badge={boardMembers.length}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-1a4 4 0 00-4-4h-1m-4 5H2v-1a4 4 0 014-4h7m0 0a4 4 0 10-8 0m8 0a4 4 0 11-8 0m8 0h4m-4 0a4 4 0 114 4v1m-4-5v-2m0 2v2" />
                    </svg>
                  </HeaderIconButton>
                </div>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {loading ? (
                "Loading..."
              ) : hasActiveFilters ? (
                <>
                  {currentDoneTasks} of {currentTotalTasks} tasks match filter .{" "}
                  <span className="font-semibold text-blue-600">{currentProgress}% done</span>
                </>
              ) : (
                <>
                  {doneTasks} of {totalTasks} tasks completed .{" "}
                  <span className="font-semibold text-green-600">{baseProgress}%</span>
                </>
              )}
            </p>
            {!loading && (
              <div className="mt-2 h-1.5 w-full max-w-72 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${hasActiveFilters ? currentProgress : baseProgress}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="relative w-full sm:w-56">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari task, assignee..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as "All" | Priority)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value="All">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "kanban"
                    ? "bg-slate-100 text-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                aria-label="Kanban view"
                aria-pressed={viewMode === "kanban"}
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "list"
                    ? "bg-slate-100 text-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => openModal("todo")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              aria-label="Add Task"
              title="Add Task"
            >
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Task</span>
            </button>

            {isOwner && board && (
              <HeaderIconButton
                label="Share Board"
                onClick={handleOpenShare}
                className="border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M13.5 10.5L20 4m0 0h-5.5M20 4v5.5M10.5 13.5L4 20m0 0h5.5M4 20v-5.5" />
                </svg>
              </HeaderIconButton>
            )}
          </div>
        </div>

        {authNotice && (
          <p className="mt-3 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {authNotice}
          </p>
        )}

        {hasActiveFilters && viewMode === "kanban" && (
          <p className="mt-3 text-xs font-medium text-blue-700">
            Drag sementara dinonaktifkan saat filter/search aktif biar urutan data tetap aman.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-x-auto p-4 md:p-6">
        {loading ? (
          <div className="flex gap-4 md:gap-6">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="min-w-[300px] flex-1 animate-pulse rounded-2xl border border-gray-200/70 bg-white/70 p-4"
              >
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="mt-4 space-y-3">
                  <div className="h-20 rounded-xl bg-gray-100" />
                  <div className="h-20 rounded-xl bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "kanban" ? (
          hasActiveFilters ? (
            <div className="flex gap-4 md:gap-6">
              {visibleColumns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  onAddTask={openModal}
                  onTaskClick={openTaskDetail}
                  disableDrag
                  emptyMessage="No tasks match your filters"
                />
              ))}
            </div>
          ) : (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 md:gap-6">
                {columns.map((column) => (
                  <Column
                    key={column.id}
                    column={column}
                    onAddTask={openModal}
                    onTaskClick={openTaskDetail}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} draggable={false} /> : null}
              </DragOverlay>
            </DndContext>
          )
        ) : hasVisibleTasks ? (
          <div className="space-y-5">
            {visibleColumns.map((column) => {
              if (column.tasks.length === 0) {
                return null;
              }

              return (
                <section
                  key={column.id}
                  className="animate-fade-up rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
                    <h2 className="text-sm font-semibold text-gray-800">{column.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.color}`}>
                      {column.tasks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {column.tasks.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={openTaskDetail} draggable={false} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 text-center">
            <p className="text-lg font-semibold text-gray-700">No task found</p>
            <p className="mt-1 text-sm text-gray-500">
              Coba ubah keyword pencarian atau priority filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPriorityFilter("All");
              }}
              className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-rose-700"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        Report
      </button>

      {createBoardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setCreateBoardOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Board
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">Create New Board</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Start a fresh workspace and give your team a clear direction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateBoardOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateBoard} className="space-y-4 px-6 py-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Board name</label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(event) => setNewBoardName(event.target.value)}
                  placeholder="e.g. Product Launch"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={newBoardDescription}
                  onChange={(event) => setNewBoardDescription(event.target.value)}
                  placeholder="Optional board description"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {createBoardError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  {createBoardError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setCreateBoardOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBoard}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingBoard ? "Creating..." : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddTaskModal
        isOpen={modalOpen && !!user}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddTask}
        columnId={modalColumnId}
        members={boardMembers}
      />

      <TaskDetailModal
        isOpen={taskDetailOpen && !!selectedTaskView}
        task={selectedTaskView}
        columnLabel={selectedColumn?.title}
        onClose={() => setTaskDetailOpen(false)}
        onSave={handleUpdateTask}
        onDelete={handleDeleteTask}
        members={boardMembers}
      />

      <ReportIssueModal
        isOpen={reportOpen}
        boardName={board?.name}
        onClose={() => {
          setReportOpen(false);
          setReportError(null);
        }}
        onSubmit={handleSubmitReport}
        submitting={reportSubmitting}
        error={reportError}
      />

      {editBoardOpen && board && isOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setEditBoardOpen(false)} />
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
              <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Board
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">Edit Board</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Rename the board or update its description.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditBoardOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleEditBoard} className="space-y-4 px-6 py-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Board name</label>
                  <input
                    type="text"
                    value={editBoardName}
                    onChange={(event) => setEditBoardName(event.target.value)}
                    placeholder="Board name"
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={editBoardDescription}
                    onChange={(event) => setEditBoardDescription(event.target.value)}
                    placeholder="Board description"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {editBoardError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                    {editBoardError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setEditBoardOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editingBoard}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingBoard ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {membersOpen && board && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMembersOpen(false)} />
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
              <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Members
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">Board Members</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      People who can access and work on this board.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMembersOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-3 px-6 py-6">
                {boardMembers.length > 0 ? (
                  boardMembers.map((member) => (
                    <div key={member.userId} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 text-sm font-bold text-white">
                        {(member.name?.slice(0, 1) || "U").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${member.role === "owner" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {member.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{member.userId}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No members found yet.
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setMembersOpen(false)}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {shareOpen && board && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setShareOpen(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Share
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">Share {board.name}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Anyone with the link can join this board after login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-4 px-6 py-6">
              {shareLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Menyiapkan link share...
                </div>
              ) : shareError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  {shareError}
                </p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Share link</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={shareLink}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                      >
                        {shareCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-blue-50 px-4 py-4 text-sm text-blue-800">
                    <p className="font-semibold">Members on this board</p>
                    <p className="mt-1 text-blue-700/80">Board members can be assigned directly from the task form.</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-blue-600">{boardMembers.length} member(s)</p>
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleOpenShare}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Regenerate Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
