"use client";

import { useState, useCallback, useId } from "react";
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
import Column from "./Column";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import { initialColumns, ColumnData, Task, Priority } from "@/lib/data";

export default function Board() {
  const [columns, setColumns] = useState<ColumnData[]>(initialColumns);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState("todo");

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const doneTasks = columns.find((c) => c.id === "done")?.tasks.length ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const findColumn = useCallback(
    (taskId: string) => {
      // Check if taskId is a column id
      const col = columns.find((c) => c.id === taskId);
      if (col) return col;
      // Otherwise find column containing this task
      return columns.find((c) => c.tasks.some((t) => t.id === taskId));
    },
    [columns]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const column = findColumn(active.id as string);
    const task = column?.tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    setColumns((prev) => {
      const activeColIndex = prev.findIndex((c) => c.id === activeColumn.id);
      const overColIndex = prev.findIndex((c) => c.id === overColumn.id);

      const activeTaskIndex = prev[activeColIndex].tasks.findIndex(
        (t) => t.id === active.id
      );
      const task = prev[activeColIndex].tasks[activeTaskIndex];

      const newColumns = [...prev];
      newColumns[activeColIndex] = {
        ...newColumns[activeColIndex],
        tasks: newColumns[activeColIndex].tasks.filter((t) => t.id !== active.id),
      };

      const overTaskIndex = newColumns[overColIndex].tasks.findIndex(
        (t) => t.id === over.id
      );
      const insertIndex = overTaskIndex >= 0 ? overTaskIndex : newColumns[overColIndex].tasks.length;

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
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn) return;

    if (activeColumn.id === overColumn.id) {
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
          return newColumns;
        });
      }
    }
  };

  const handleAddTask = useCallback(
    (task: {
      title: string;
      description: string;
      priority: Priority;
      dueDate: string;
      assigneeName: string;
    }) => {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "No date",
        assignee: {
          name: task.assigneeName || "Unassigned",
          avatar: (task.assigneeName || "U")[0].toUpperCase(),
        },
      };

      setColumns((prev) =>
        prev.map((col) =>
          col.id === modalColumnId
            ? { ...col, tasks: [...col.tasks, newTask] }
            : col
        )
      );
    },
    [modalColumnId]
  );

  const openModal = (columnId: string) => {
    setModalColumnId(columnId);
    setModalOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col bg-gray-50">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product Roadmap</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {doneTasks} of {totalTasks} tasks completed ·{" "}
            <span className="font-medium text-green-600">{progress}%</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggles */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            <button className="rounded-md bg-gray-100 p-1.5 text-gray-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button className="rounded-md p-1.5 text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Filter */}
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>

          {/* Add Task */}
          <button
            onClick={() => openModal("todo")}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6">
            {columns.map((column) => (
              <Column key={column.id} column={column} onAddTask={openModal} />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Help button */}
      <button className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg transition-colors hover:bg-gray-700">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Modal */}
      <AddTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddTask}
        columnId={modalColumnId}
      />
    </div>
  );
}
