import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { API_BASE, apiRequest } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import Link from "next/link";

interface JobListItem {
  id: string;
  documentType: string;
  profileId: string;
  status: string;
  isFree: boolean;
  centerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const uid = getUserId();
    // Login check temporarily disabled for testing

    async function loadJobs() {
      try {
        const res = await apiRequest<JobListItem[]>("/documents", {
          headers: {
            "x-user-id": uid || "",
          },
        });
        setJobs(res);
      } catch (err) {
        console.error(err);
        setError("Failed to load documents.");
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [router]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  async function handleDownload(jobId: string) {
    const uid = getUserId();
    // Login check temporarily disabled for testing

    // Direct link to avoid Blob memory issues and browser interruptions
    try {
      setDownloadingId(jobId);
      setError("");

      const downloadUrl = `${API_BASE}/documents/${jobId}/download`;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute('download', `${jobId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Hand off to browser download manager
    } catch (err) {
      console.error(err);
      setError("Failed to download file.");
    } finally {
      // Small delay to reset UI state
      setTimeout(() => setDownloadingId(null), 1000);
    }
  }

  function statusBadge(status: string) {
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium";
    if (status === "done") {
      return (
        <span
          className={`${base} bg-emerald-500/15 text-emerald-200 border border-emerald-500/40`}
        >
          ● Done
        </span>
      );
    }
    if (status === "processing") {
      return (
        <span
          className={`${base} bg-amber-500/15 text-amber-200 border border-amber-500/40`}
        >
          ● Processing
        </span>
      );
    }
    if (status === "error") {
      return (
        <span
          className={`${base} bg-red-500/15 text-red-200 border border-red-500/40`}
        >
          ● Error
        </span>
      );
    }
    return (
      <span
        className={`${base} bg-slate-500/15 text-slate-200 border border-slate-500/40`}
      >
        ● {status}
      </span>
    );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-sky-200 hover:text-sky-100 underline"
          >
            ← Back to dashboard
          </button>
          <div className="flex items-center gap-2 text-sky-100 text-sm">
            <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </span>
            <span className="font-medium">DocStudio · My Documents</span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
                Formatted documents
              </h1>
              <p className="text-sm text-slate-200/80">
                Every time you upload a .docx file, DocStudio creates a job
                here. You can download the formatted version at any time.
              </p>
            </div>

            <button
              onClick={() => router.push("/upload")}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition"
            >
              + Upload new document
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <p className="text-slate-200 text-sm">Loading documents…</p>
          )}

          {!loading && jobs.length === 0 && !error && (
            <p className="text-sm text-slate-200">
              You have not uploaded any documents yet.{" "}
              <button
                onClick={() => router.push("/upload")}
                className="text-sky-300 hover:text-sky-200 underline text-xs"
              >
                Upload your first document →
              </button>
            </p>
          )}

          {!loading && jobs.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900/70 border-b border-slate-700/80">
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Job ID
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Document Type
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Profile
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Status
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Free?
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Created
                    </th>
                    <th className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, index) => (
                    <tr
                      key={job.id}
                      className={`border-b border-slate-800/80 ${index % 2 === 0
                        ? "bg-slate-950/40"
                        : "bg-slate-900/40"
                        } hover:bg-slate-800/60`}
                    >
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <span className="font-mono text-[11px] text-slate-200 break-all">
                          {job.id}
                        </span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <p className="text-xs text-slate-50">
                          {docTypeLabel(job.documentType)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {job.documentType}
                        </p>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-100 text-[11px] border border-slate-500/40">
                          {job.profileId}
                        </span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        {statusBadge(job.status)}
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-slate-500/40 ${job.isFree
                            ? "bg-emerald-500/10 text-emerald-200"
                            : "bg-slate-500/10 text-slate-200"
                            }`}
                        >
                          {job.isFree ? "Free" : "Paid"}
                        </span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <span className="text-[11px] text-slate-200">
                          {formatDate(job.createdAt)}
                        </span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/dashboard/documents/${job.id}`}
                            className="text-xs text-emerald-300 hover:text-emerald-200 underline"
                          >
                            View
                          </Link>

                          {job.status === "done" ? (
                            <button
                              onClick={() => handleDownload(job.id)}
                              className="text-xs text-sky-300 hover:text-sky-200 underline disabled:opacity-60 text-left"
                              disabled={downloadingId === job.id}
                            >
                              {downloadingId === job.id
                                ? "Downloading..."
                                : "Download"}
                            </button>
                          ) : job.status === "processing" ? (
                            <span className="text-[11px] text-slate-300">
                              Processing…
                            </span>
                          ) : job.status === "error" ? (
                            <span className="text-[11px] text-red-300">
                              Error – reupload
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300">
                              {job.status}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
