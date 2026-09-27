import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiRequest, downloadUrl } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import Link from "next/link";
import { docTypeLabel } from "@/lib/documentTypes";

interface JobListItem {
  id: string;
  documentType: string;
  profileId: string;
  originalName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getUserId()) {
      router.push("/login");
      return;
    }
  }, [router]);

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await apiRequest<JobListItem[]>("/documents");
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
                    {["Document", "Type", "Status", "Created", "Actions"].map((h) => (
                      <th key={h} className="border border-slate-700/80 px-3 py-2 text-left text-xs text-slate-200">
                        {h}
                      </th>
                    ))}
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
                        <span className="text-xs text-slate-50 break-all">
                          {job.originalName || `Document ${job.id.slice(0, 8)}`}
                        </span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        <span className="text-xs text-slate-50">{docTypeLabel(job.documentType)}</span>
                      </td>
                      <td className="border border-slate-800/80 px-3 py-2 align-top">
                        {statusBadge(job.status)}
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
                            <a
                              href={downloadUrl(job.id)}
                              className="text-xs text-sky-300 hover:text-sky-200 underline"
                            >
                              Download
                            </a>
                          ) : job.status === "processing" ? (
                            <span className="text-[11px] text-slate-300">
                              Processing…
                            </span>
                          ) : job.status === "error" ? (
                            <span className="text-[11px] text-red-300">
                              Failed – see details
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
