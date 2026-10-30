"use client";

import { Flag } from "lucide-react";
import { submitReportAction } from "@/lib/actions/messaging";
import { Button } from "@/components/ui";

export function ReportButton({ targetType, targetId }: { targetType: "job" | "user" | "company" | "message"; targetId: string }) {
  async function report() {
    const reason = window.prompt("Why are you reporting this?");
    if (!reason || reason.trim().length < 3) return;
    const result = await submitReportAction({ targetType, targetId, reason: reason.trim() });
    window.alert(result.error ?? "Thanks — our moderation team will review this report.");
  }
  return (
    <Button variant="ghost" size="sm" onClick={report} className="text-gray-400 hover:text-red-600">
      <Flag className="h-4 w-4" /> Report
    </Button>
  );
}
