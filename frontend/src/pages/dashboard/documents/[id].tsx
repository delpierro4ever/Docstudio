import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiRequest, downloadUrl } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { docTypeLabel } from "@/lib/documentTypes";
import FeedbackForm from "@/components/FeedbackForm";

interface JobDetail {
  id: string;
  profileId: string;
  documentType: string;
  originalName: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentViewerPage() {
  const router = useRouter();
  const { id } = router.query;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reformatting, setReformatting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!getUserId()) router.push("/login");
  }, [router]);

  // Load job details
  useEffect(() => {
    if (!id || !getUserId()) return;

    const jobId = Array.isArray(id) ? id[0] : id;

    apiRequest<JobDetail>(`/documents/${jobId}`)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load document details."))
      .finally(() => setLoadingJob(false));
  }, [id]);

  // Poll while processing
  useEffect(() => {
    if (!id || !job || job.status !== "processing") return;
    const jobId = Array.isArray(id) ? id[0] : id;

    const interval = setInterval(async () => {
      try {
        const data = await apiRequest<JobDetail>(`/documents/${jobId}`);
        setJob(data);
        if (data.status !== "processing") clearInterval(interval);
      } catch {
        // transient — keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, job?.status]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }


  async function handleReformat() {
    if (!job) return;

    try {
      setReformatting(true);
      setError(null);
      setInfo(null);

      const data = await apiRequest<{ job: JobDetail }>(`/documents/${job.id}/reformat`, {
        method: "POST",
      });
      setJob(data.job);
      setInfo("Reformatted successfully. Download the latest version below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reformat document.");
    } finally {
      setReformatting(false);
    }
  }

  if (loadingJob) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300 text-sm">
        Loading document…
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-red-400 text-sm">
        Document not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-2xl mx-auto">

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
            <span className="font-medium">DocStudio</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8 text-slate-100">

          <h2 className="text-2xl font-semibold mb-1 break-words">
            {job.originalName || docTypeLabel(job.documentType)}
          </h2>
          <p className="text-xs text-slate-400 mb-6">{docTypeLabel(job.documentType)}</p>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 mb-6">
            <div>
              <p className="text-slate-500 mb-0.5">Status</p>
              <p className="text-slate-50 capitalize">{job.status}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Profile</p>
              <p className="text-slate-50">{job.profileId}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Created</p>
              <p className="text-slate-50">{formatDate(job.createdAt)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Reference</p>
              <p className="text-slate-50 font-mono">{job.id.slice(0, 8)}</p>
            </div>
          </div>

          {router.query.claimed && (
            <p className="text-emerald-200 text-sm bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2 mb-4">
              Welcome! The document you formatted is now saved in your account.
            </p>
          )}
          {job.status === "error" && job.errorMessage && (
            <p className="text-red-300 text-xs mb-4">Formatting failed: {job.errorMessage}</p>
          )}
          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
          {info && <p className="text-emerald-300 text-xs mb-4">{info}</p>}

          {/* Primary action */}
          {job.status === "done" ? (
            <>
              <a
                href={downloadUrl(job.id)}
                className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-black font-medium py-3 rounded-lg text-sm transition mb-2"
              >
                Download formatted document
              </a>
              <p className="text-[11px] text-slate-400 mb-4">
                Tip: open it in Microsoft Word. If Word asks to update fields, choose <b>Yes</b> so the
                page numbers and table of contents fill in.
              </p>
            </>
          ) : (
            <div className="w-full bg-slate-800 text-slate-400 text-center py-3 rounded-lg text-sm mb-3">
              {job.status === "processing" ? "Still processing…" : "Not ready for download"}
            </div>
          )}

          {/* Secondary actions */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => router.push("/upload")}
              className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-lg px-4 py-2.5 text-sm hover:bg-slate-800/80 transition"
            >
              Upload another document
            </button>
            <button
              onClick={() => router.push("/documents")}
              className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-lg px-4 py-2.5 text-sm hover:bg-slate-800/80 transition"
            >
              My documents
            </button>
            <button
              onClick={handleReformat}
              disabled={reformatting}
              className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-lg px-4 py-2.5 text-sm hover:bg-slate-800/80 disabled:opacity-60 transition"
            >
              {reformatting ? "Reformatting…" : "Re-run formatting"}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-lg px-4 py-2.5 text-sm hover:bg-slate-800/80 transition"
            >
              Go to dashboard
            </button>
          </div>

          {(job.status === "done" || job.status === "error") && (
            <div className="mt-6">
              <FeedbackForm jobId={job.id} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
