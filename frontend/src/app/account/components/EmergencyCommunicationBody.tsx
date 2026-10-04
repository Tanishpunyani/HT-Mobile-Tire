"use client";

import { formatNotificationBody } from "@/lib/utils/format-notification";

interface EmergencyCommunicationBodyProps {
  body?: string | null;
  subject?: string | null;
}

export default function EmergencyCommunicationBody({
  body,
  subject,
}: EmergencyCommunicationBodyProps) {
  const formatted = formatNotificationBody(body);
  const displayText =
    formatted ||
    (subject ? subject.trim() : "") ||
    "Central Roadside Dispatch communication recorded.";

  return (
    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
      {displayText}
    </p>
  );
}
