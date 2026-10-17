"use client";
import { useEffect } from "react";
import { reportClientError } from "./telemetry";

// Global browser error capture (window.onerror + unhandled promise rejections).
export default function ErrorListener() {
  useEffect(() => {
    const onErr = (e) => reportClientError(e?.error || e?.message || "Error", "onerror");
    const onRej = (e) => reportClientError(e?.reason instanceof Error ? e.reason : String(e?.reason ?? "Unhandled rejection"), "rejection");
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  return null;
}
