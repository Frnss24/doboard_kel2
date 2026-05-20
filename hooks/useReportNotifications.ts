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

  const fetchReports = useCallback(async () => {
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("reports")
      .select("id, title, message, status, decision_note, created_at, updated_at")
      .eq("reporter_id", user.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch report notifications error:", error);
      setReports([]);
    } else {
      setReports((data ?? []) as ReportNotification[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    fetchReports();

    const intervalId = window.setInterval(() => {
      fetchReports();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, fetchReports]);

  const responses = reports.filter(hasAdminResponse);

  return {
    loading: authLoading || loading,
    reports,
    responses,
    unreadCount: responses.length,
    refresh: fetchReports,
  };
}