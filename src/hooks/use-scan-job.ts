"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ScanJob, ScanJobStatus } from "@/lib/types";

/**
 * Subscribe to a scan_jobs row via Supabase Realtime.
 * Returns the job status, result, and error.
 */
export function useScanJob(jobId: string | null) {
  const [status, setStatus] = useState<ScanJobStatus>("queued");
  const [result, setResult] = useState<ScanJob["result"]>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("scan_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (data) {
      setStatus(data.status as ScanJobStatus);
      setResult(data.result);
      setError(data.error);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    // Fetch initial state
    fetchJob();

    // Subscribe to updates on this specific row
    const channel = supabase
      .channel(`scan-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scan_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updated = payload.new as ScanJob;
          setStatus(updated.status);
          setResult(updated.result);
          setError(updated.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchJob]);

  return { status, result, error };
}
