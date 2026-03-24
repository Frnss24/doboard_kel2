"use client";

import { useEffect, useState } from "react";
import { Priority, Task } from "@/lib/data";

interface TaskDetailModalProps {
  isOpen: boolean;
  task: Task | null;
  columnLabel?: string;
  onClose: () => void;
  onSave: (task: {
    title: string;
    description: string;
    priority: Priority;
    dueDate: string;
    assigneeName: string;
  }) => Promise<void>;
}

export default function TaskDetailModal({
  isOpen,
  task,
  columnLabel,
  onClose,
  onSave,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task || !isOpen) return;

    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDateRaw ?? "");
    setAssigneeName(task.assignee.name);
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        title,
        description,
        priority,
        dueDate,
        assigneeName,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Task Detail</h2>
            <p className="text-sm text-gray-500">
              {columnLabel ? `Kolom: ${columnLabel}` : "Edit detail task kamu"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Assignee Name</label>
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              disabled={saving}
            >
              Close
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
