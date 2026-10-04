/**
 * Utility for formatting and sanitizing NotificationLog bodies for display in the customer portal.
 * Safely extracts human-readable text from HTML email bodies, strips non-content tags,
 * and preserves plain-text messages without exposing raw HTML markup.
 */

export function formatNotificationBody(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  // If the body does not contain HTML tags, treat as plain text directly
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  let text = trimmed;

  // 1. Remove non-content / hidden blocks: comments, head, style, script
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");

  // 2. Format details table rows (label on left, value on right -> "Label: Value")
  text = text.replace(/<\/td>\s*<td[^>]*>/gi, ": ");

  // 3. Convert structural blocks into appropriate whitespace
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/table>/gi, "\n\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "• ");

  // 4. Strip all remaining HTML tags (ensures zero XSS or raw tag leakage)
  text = text.replace(/<[^>]+>/g, "");

  // 5. Decode standard HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&copy;|&#169;/gi, "©")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&bull;|&#8226;/gi, "•")
    .replace(/&rarr;|&#8594;/gi, "→")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 6. Split into lines, trim each line
  const rawLines = text.split("\n").map((l) => l.trim());

  // Filter out redundant outer branded wrapper artifacts (header badges, footer boilerplates)
  const contentLines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) {
      contentLines.push("");
      continue;
    }
    if (line === "Roadside Emergency") continue;
    if (
      line === "HT Mobile Tires" &&
      (rawLines[i + 1] === "On-Demand Roadside & Driveway Tire Service" ||
        rawLines[i - 1] === "Roadside Emergency")
    ) {
      continue;
    }
    if (line === "On-Demand Roadside & Driveway Tire Service") continue;
    if (line.includes("HT Mobile Tires • Fast Roadside & On-Site Tire Care")) continue;
    if (line.includes("©") && line.includes("HT Mobile Tires")) continue;
    if (line.startsWith("Track Status in Customer Account")) continue;
    contentLines.push(line);
  }

  // Group and collapse consecutive blank lines to standard paragraph breaks
  return contentLines
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
