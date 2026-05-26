"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

export interface ReportNotification {
  id: string;
  title: string;
  message: string;
  status: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string | null;
}

function hasAdminResponse(report: ReportNotification) {
  return (report.status ?? "open") !== "open" || Boolean(report.decision_note?.trim());
}

export function useReportNotifications() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [reports, setReports] = useState<ReportNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<Record<string, true>>(() => {
    try {
      if (typeof window === "undefined") return {};
      const raw = window.localStorage.getItem("seen_reports");
      return raw ? (JSON.parse(raw) as Record<string, true>) : {};
    } catch {
      return {};
    }
  });

  const fetchReports = useCallback(async () => {
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // determine if current user is admin
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      let fetched: any[] = [];

      if (profile?.role === "admin") {
        // Admin: fetch all reports (admin needs to see incoming reports)
        const { data: adminReports, error: adminErr } = await supabase
          .from("reports")
          .select("id, title, message, status, decision_note, created_at, updated_at, reporter_id, reporter_email")
          .order("created_at", { ascending: false });

        if (adminErr) throw adminErr;
        fetched = adminReports ?? [];
      } else {
        // Regular user: fetch their own reports and admin responses
        const { data: userReports, error: userErr } = await supabase
          .from("reports")
          .select("id, title, message, status, decision_note, created_at, updated_at")
          .eq("reporter_id", user.id)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (userErr) throw userErr;
        fetched = userReports ?? [];
      }

      setReports(fetched as ReportNotification[]);
    } catch (err) {
      console.error("Fetch report notifications error:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    fetchReports();

    const intervalId = window.setInterval(() => {
      fetchReports();
    }, 30000);

    // Subscribe to realtime changes on reports to refresh instantly
    const channel = supabase
      .channel("reports-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // fallback: unsubscribe if removeChannel not available
        // @ts-ignore
        channel.unsubscribe?.();
      }
    };
  }, [authLoading, fetchReports]);

  // Determine unread/responses based on presence of admin fields
  const responses = reports.filter(hasAdminResponse);
  const openReports = reports.filter((r) => (r.status ?? "open") === "open");

  // unreadCount should exclude locally-seen ids (for both admin and users)
  const adminOpenUnread = openReports.filter((r) => !seenIds[r.id]);
  const userResponsesUnread = responses.filter((r) => !seenIds[r.id]);

  const markAllAsRead = async () => {
    // Determine which ids to mark depending on view (admin vs user)
    const isAdminView = reports.length > 0 && (reports[0] as any).reporter_id;
    const idsToMark = isAdminView ? openReports.map((r) => r.id) : responses.map((r) => r.id);
    if (idsToMark.length === 0) return;

    try {
      // Attempt DB update. For admin mark `admin_seen`, for user mark `reporter_seen`.
      if (isAdminView) {
        const { error } = await supabase.from("reports").update({ admin_seen: true }).in("id", idsToMark);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reports").update({ reporter_seen: true }).in("id", idsToMark);
        if (error) throw error;
      }
    } catch (err) {
      // Fallback: persist in localStorage
      const next = { ...seenIds };
      for (const id of idsToMark) next[id] = true;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("seen_reports", JSON.stringify(next));
        }
      } catch (e) {
        // ignore
      }
      setSeenIds(next);
    }
  };

  return {
    loading: authLoading || loading,
    reports,
    responses,
    // If the fetched list contains reporter_id field, we fetched admin view
    unreadCount: reports.length > 0 && (reports[0] as any).reporter_id ? adminOpenUnread.length : userResponsesUnread.length,
    refresh: fetchReports,
    markAllAsRead,
  };
}