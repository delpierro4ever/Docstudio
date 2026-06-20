import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getUserId } from "@/lib/auth";

interface JobDetail {
  id: string;
  userId: string;
  profileId: string;
  documentType: string;
  status: string;
  inputPath?: string;
  outputPath?: string;
  errorMessage?: string;
  isFree: boolean;
  priceCfa?: number;
  centerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentViewerPage() {
  const router = useRouter();
  const { id } = router.query;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = 100%
  const [reformatting, setReformatting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Load job details
  useEffect(() => {
    if (!id) return;

    const uid = getUserId();
    // Login check disabled

    async function loadJob(userId: string, jobId: string) {
      try {
        setLoadingJob(true);
        setError(null);

        const data = await apiRequest<JobDetail>(`/documents/${jobId}`, {
          headers: { "x-user-id": userId },
        });

        setJob(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load document details.");
        setJob(null);
      } finally {
        setLoadingJob(false);
      }
    }

    const idString = Array.isArray(id) ? id[0] : (id as string);
    loadJob(uid || "", idString);
  }, [id, router]);

  // Poll for status updates when processing
  useEffect(() => {
    if (!id || !job) return;

    // Only poll if status is "processing"
    if (job.status !== "processing") return;

    const uid = getUserId();
    // Login check disabled

    const idString = Array.isArray(id) ? id[0] : (id as string);

    const pollInterval = setInterval(async () => {
      try {
        const data = await apiRequest<JobDetail>(`/documents/${idString}`, {
          headers: { "x-user-id": uid || "" }, // Fix type error
        });

        setJob(data);

        // Stop polling if status changed from processing
        if (data.status !== "processing") {
          clearInterval(pollInterval);

          // Reload preview when done
          if (data.status === "done") {
            try {
              const res = await apiRequest<{ previewHtml: string | null }>(
                `/documents/${idString}/preview`,
                {
                  headers: { "x-user-id": uid || "" },
                }
              );
              setPreviewHtml(res.previewHtml ?? null);
            } catch (err) {
              console.error("Failed to reload preview:", err);
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
        // Don't stop polling on error, might be transient
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [id, job?.status]);

  // Load HTML preview
  useEffect(() => {
    if (!id) return;

    const uid = getUserId();
    // Login check disabled

    async function loadPreview(userId: string, jobId: string) {
      try {
        setPreviewLoading(true);

        const res = await apiRequest<{ previewHtml: string | null }>(
          `/documents/${jobId}/preview`,
          {
            headers: { "x-user-id": userId },
          }
        );

        setPreviewHtml(res.previewHtml ?? null);
      } catch (err) {
        console.error(err);
        setPreviewHtml(null);
      } finally {
        setPreviewLoading(false);
      }
    }

    const idString = Array.isArray(id) ? id[0] : (id as string);
    loadPreview(uid || "", idString);
  }, [id]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function docTypeLabel(type: string) {
    switch (type) {
      case "report":
        return "Student Report";
      case "undergraduate":
        return "Undergraduate Thesis";
      case "masters":
        return "Masters Thesis";
      case "phd":
        return "PhD Thesis";
      default:
        return type;
    }
  }

  async function handleDownload() {
    if (!job) return;

    const uid = getUserId();
    // Login check disabled

    // Direct link to avoid Blob memory issues and browser interruptions
    try {
      setDownloading(true);
      setError(null);

      const downloadUrl = `http://localhost:8000/documents/${job.id}/download`;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `${job.documentType}-${job.id}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Hand off to browser download manager
    } catch (err) {
      console.error(err);
      setError("Failed to download file.");
    } finally {
      // Small delay to reset UI state
      setTimeout(() => setDownloading(false), 1000);
    }
  }


  async function handleReformat() {
    if (!job) return;

    const uid = getUserId();
    // Login check disabled

    try {
      setReformatting(true);
      setError(null);
      setInfo(null);

      const res = await fetch(
        `http://localhost:8000/documents/${job.id}/reformat`,
        {
          method: "POST",
          headers: {
            "x-user-id": uid || "", // Fix type error
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Reformat error:", text);
        setError("Failed to reformat document.");
        return;
      }

      const data = await res.json();

      // Update job state (status, updatedAt, etc.)
      setJob(data.job);
      setInfo("Document reformatted successfully. You can download the latest version.");
    } catch (err) {
      console.error(err);
      setError("Failed to reformat document.");
    } finally {
      setReformatting(false);
    }
  }


  if (loadingJob) {
    return <p className="p-6 text-slate-300 text-sm">Loading document…</p>;
  }

  if (error && !job) {
    return <p className="p-6 text-red-400 text-sm">{error}</p>;
  }

  if (!job) {
    return <p className="p-6 text-red-400 text-sm">Document not found.</p>;
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/documents")}
            className="text-xs text-sky-200 hover:text-sky-100 underline"
          >
            ← Back to documents
          </button>
          <div className="flex items-center gap-2 text-sky-100 text-sm">
            <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </span>
            <span className="font-medium">DocStudio · Document Viewer</span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] gap-6">
            {/* Left panel: job details + download + navigation */}
            <div className="border border-slate-800 rounded-lg p-4 bg-[#0A0A0A] flex flex-col gap-4 text-slate-100">
              <div>
                <h2 className="text-lg font-semibold">
                  {docTypeLabel(job.documentType)}
                </h2>
                <p className="text-[11px] text-slate-400 break-all font-mono mt-1">
                  Job ID: {job.id}
                </p>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p>
                  Status:{" "}
                  <span className="capitalize text-slate-50">
                    {job.status}
                  </span>
                </p>
                <p>
                  Created:{" "}
                  <span className="text-slate-50">
                    {formatDate(job.createdAt)}
                  </span>
                </p>
                <p>
                  Billing:{" "}
                  <span className="text-slate-50">
                    {job.isFree ? "Free document" : "Paid document"}
                  </span>
                  {typeof job.priceCfa === "number" && !job.isFree && (
                    <> · {job.priceCfa} FCFA</>
                  )}
                </p>
                {job.errorMessage && (
                  <p className="text-red-300 text-[11px]">
                    Error: {job.errorMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-3">
                {job.status === "done" ? (
                  <button
                    onClick={handleDownload}
                    className="text-sm px-3 py-2 bg-emerald-500 text-black rounded-md text-center hover:bg-emerald-600 disabled:opacity-60"
                    disabled={downloading}
                  >
                    {downloading ? "Downloading…" : "Download formatted"}
                  </button>
                ) : (
                  <button
                    disabled
                    className="text-sm px-3 py-2 bg-slate-800 text-slate-400 rounded-md cursor-not-allowed"
                  >
                    {job.status === "processing"
                      ? "Still processing…"
                      : "Not ready for download"}
                  </button>
                )}

                {/* Secondary actions */}
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  <button
                    onClick={() => router.push("/documents")}
                    className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-1.5 text-xs hover:bg-slate-800/80"
                  >
                    Go to My documents
                  </button>
                  <button
                    onClick={() => router.push("/upload")}
                    className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-1.5 text-xs hover:bg-slate-800/80"
                  >
                    Upload another document
                  </button>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-1.5 text-xs hover:bg-slate-800/80"
                  >
                    Go to dashboard
                  </button>
                  <button
                    onClick={handleReformat}
                    disabled={reformatting}
                    className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-1.5 text-xs hover:bg-slate-800/80 disabled:opacity-60"
                  >
                    {reformatting ? "Reformatting…" : "Re-run formatting"}
                  </button>

                </div>
              </div>

              {info && (
                <p className="text-xs text-emerald-300 mt-2">{info}</p>
              )}
              {error && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
              )}

            </div>

            {/* Right panel: HTML preview in A4-like page */}
            <div className="border border-slate-800 rounded-lg bg-[#0A0A0A] p-4 flex flex-col h-[70vh]">
              {/* Header + toolbar */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Preview (read-only)
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Word formatting converted to HTML (headings, bold, etc.)
                  </span>
                </div>

                {/* Zoom controls */}
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="hidden md:inline">Zoom</span>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((z) => Math.max(0.8, z - 0.1))
                    }
                    className="px-2 py-1 border border-slate-600 rounded-md bg-slate-900/60 hover:bg-slate-800/80"
                  >
                    –
                  </button>
                  <span className="w-10 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((z) => Math.min(1.4, z + 0.1))
                    }
                    className="px-2 py-1 border border-slate-600 rounded-md bg-slate-900/60 hover:bg-slate-800/80"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Page area */}
              <div className="flex-1 overflow-auto bg-slate-950 border border-slate-900 rounded-lg p-4">
                <div className="flex justify-center">
                  {/* Simulated A4 page */}
                  <div
                    className="bg-white text-black rounded-md shadow-lg px-10 py-8"
                    style={{
                      width: "800px",
                      minHeight: "1130px",          // 👈 A4-like height at this width
                      // or `height: "1130px"` if you want strictly fixed height
                      transform: `scale(${zoom})`,
                      transformOrigin: "top center",
                    }}
                  >
                    {previewLoading ? (
                      <p className="text-slate-500 text-sm">
                        Loading preview…
                      </p>
                    ) : previewHtml ? (
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <p className="text-slate-500 text-sm">
                        No preview available. Download the file to view it in
                        Word.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
