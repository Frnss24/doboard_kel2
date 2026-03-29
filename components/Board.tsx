"use client";

import { useState, useCallback, useId, useMemo } from "react";
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
import { Task, Priority } from "@/lib/data";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

export default function Board() {
  const router = useRouter();
  const { columns, setColumns, loading, addTask, reorderTasks, updateTask } = useSupabaseTasks();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState("todo");
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const doneTasks = columns.find((c) => c.id === "done")?.tasks.length ?? 0;
  const baseProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const hasActiveFilters = searchQuery.trim().length > 0 || priorityFilter !== "All";

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
          task.assignee.name,
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
      assigneeName: string;
    }) => {
      if (!user) {
        setAuthNotice("Kamu harus login dulu sebelum menambah task.");
        router.push("/login?next=/");
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
      router.push("/login?next=/");
      return;
    }

    setAuthNotice(null);
    setModalColumnId(columnId);
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
      assigneeName: string;
    }) => {
      if (!selectedTask) return;

      await updateTask(selectedTask.id, task);
      setTaskDetailOpen(false);
    },
    [selectedTask, updateTask]
  );

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col bg-[radial-gradient(circle_at_top_right,_#dbeafe,_#f8fafc_42%,_#f8fafc)]">
      <div className="border-b border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">DoBOARD</h1>
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
                    ? "bg-gray-100 text-gray-700"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                aria-label="Kanban view"
                aria-pressed={viewMode === "kanban"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    ? "bg-gray-100 text-gray-700"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={() => openModal("todo")}
              className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
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

      <button className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gray-700">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      <AddTaskModal
        isOpen={modalOpen && !!user}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddTask}
        columnId={modalColumnId}
      />

      <TaskDetailModal
        isOpen={taskDetailOpen && !!selectedTaskView}
        task={selectedTaskView}
        columnLabel={selectedColumn?.title}
        onClose={() => setTaskDetailOpen(false)}
        onSave={handleUpdateTask}
      />
    </div>
  );
}
