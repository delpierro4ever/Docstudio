// backend/src/services/preview.ts
import mammoth from "mammoth";

/**
 * Extract an HTML preview from a DOCX file on disk.
 * Mammoth converts Word styles (headings, bold, etc.) into HTML tags.
 */
export async function extractPreviewHtml(
  filePath: string,
  maxChars = 20000
): Promise<string | null> {
  try {
    const result = await mammoth.convertToHtml({ path: filePath });
    let html = result.value || "";

    html = html.trim();
    if (!html) return null;

    // Optional: truncate very large documents
    if (html.length > maxChars) {
      html = html.slice(0, maxChars) + "<p>...[preview truncated]</p>";
    }

    return html;
  } catch (err) {
    console.error("Error extracting preview HTML:", err);
    return null;
  }
}
