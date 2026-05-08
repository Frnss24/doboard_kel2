"use client";

import { useEffect, useState } from "react";

export type ReportCategory = "board_issue" | "task_issue" | "bug" | "other";

interface ReportIssueModalProps {
  isOpen: boolean;
  boardName?: string;
  onClose: () => void;
  onSubmit: (payload: {
    category: ReportCategory;
    title: string;
    message: string;
  }) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

const categoryOptions: { value: ReportCategory; label: string; description: string }[] = [
  { value: "board_issue", label: "Board issue", description: "Problem with the board layout, access, or behavior." },
  { value: "task_issue", label: "Task issue", description: "A task is missing, duplicated, or incorrect." },
  { value: "bug", label: "Bug", description: "Something in the app is not working as expected." },
  { value: "other", label: "Other", description: "Anything else the admin should review." },
];

export default function ReportIssueModal({
  isOpen,
  boardName,
  onClose,
  onSubmit,
  submitting = false,
  error,
}: ReportIssueModalProps) {
  const [category, setCategory] = useState<ReportCategory>("board_issue");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setCategory("board_issue");
    setTitle(boardName ? `${boardName} issue` : "Board issue");
    setMessage("");
  }, [boardName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage || submitting) return;

    await onSubmit({
      category,
      title: cleanTitle,
      message: cleanMessage,
    });
  };

  const selectedCategory = categoryOptions.find((option) => option.value === category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400" />

        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                Report issue
              </p>
              <h2 className="text-lg font-bold text-slate-900">Send a report to admin</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Tell the admin what happened so it can be reviewed quickly.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ReportCategory)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <p className="mt-2 text-xs leading-5 text-slate-500">{selectedCategory.description}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Short summary of the issue"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={`Explain what happened in ${boardName ?? "this board"}`}
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              required
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
