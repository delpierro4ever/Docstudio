// "Try before you sign up": a visitor formats a document without an
// account, sees preview pages of the result, and creates an account (or
// logs in) to download it. The backend ties the trial to this browser
// with a cookie and moves it into the account on register/login.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { API_BASE, errorMessage } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { docTypeLabel } from "@/lib/documentTypes";
import FormatForm from "@/components/FormatForm";

interface TrialJob {
  id: string;
  documentType: string;
  originalName: string | null;
  status: string;
  pageCount: number | null;
  previewPages: number[];
}

function previewUrl(jobId: string, n: number): string {
  return `${API_BASE}/try/${encodeURIComponent(jobId)}/preview/${n}`;
}

export default function TryPage() {
  const router = useRouter();
  const jobParam = typeof router.query.job === "string" ? router.query.job : null;

  const [job, setJob] = useState<TrialJob | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<number | null>(null);

  // Escape closes the enlarged page.
  useEffect(() => {
    if (zoomed === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  // Signed-in users use the normal upload page.
  useEffect(() => {
    if (getUserId()) router.replace("/upload");
  }, [router]);

  // Reload the result after a page refresh (?job=<id>).
  useEffect(() => {
    if (!jobParam || job?.id === jobParam) return;
    fetch(`${API_BASE}/try/${encodeURIComponent(jobParam)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res, "This preview is no longer available."));
        setJob(await res.json());
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This preview is no longer available."));
  }, [jobParam, job?.id]);

  async function tryIt(formData: FormData): Promise<string | null> {
    const res = await fetch(`${API_BASE}/try`, { method: "POST", body: formData, credentials: "include" });
    if (!res.ok) return errorMessage(res, "We could not format this document. Please try again.");
    const data: { job: TrialJob } = await res.json();
    setJob(data.job);
    router.replace(`/try?job=${data.job.id}`, undefined, { shallow: true });
    return null;
  }

  if (jobParam && !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className={loadError ? "text-red-300 text-sm mb-4" : "text-slate-300 text-sm"}>
            {loadError || "Loading your preview…"}
          </p>
          {loadError && (
            <button onClick={() => { setLoadError(null); router.replace("/try"); }} className="text-sky-300 text-sm underline">
              Format a document
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <FormatForm
        title="DocStudio · Try it free"
        intro={
          <p className="text-sm text-sky-100 bg-sky-500/10 border border-sky-400/20 rounded-xl px-4 py-3 mb-8 text-center">
            No account needed. Upload your document, see the formatted pages, and only sign up if you like the result.
          </p>
        }
        busyLabel="Formatting your document… a thesis can take 1–3 minutes"
        onSubmit={tryIt}
      />
    );
  }

  const pages = job.previewPages;
  const pageLabel = (i: number) =>
    job.pageCount ? `Page ${pages[i]} of ${job.pageCount}` : `Page ${pages[i]}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => { setJob(null); router.replace("/try"); }}
            className="text-xs text-sky-200 hover:text-sky-100 underline"
          >
            ← Format another document
          </button>
          <div className="flex items-center gap-2 text-sky-100 text-sm">
            <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">A</span>
            <span className="font-medium">DocStudio · Your preview</span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">✓ Formatting done</p>
            <h1 className="text-2xl font-semibold text-white mb-1 break-words">
              {job.originalName || "Your document"}
            </h1>
            <p className="text-sm text-slate-300">
              {docTypeLabel(job.documentType)}
              {job.pageCount ? ` · ${job.pageCount} pages` : ""}
              {" · "}Create a free account to download the Word file. Your document stays saved in your account.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:w-64">
            <button
              onClick={() => router.push("/register?from=try")}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-md text-sm font-semibold transition"
            >
              Create free account &amp; download
            </button>
            <button
              onClick={() => router.push("/login?from=try")}
              className="w-full text-sky-200 hover:text-sky-100 text-xs underline"
            >
              I already have an account
            </button>
          </div>
        </div>

        {pages.length > 0 ? (
          <>
            <p className="text-sm text-slate-300 mb-4">
              Here are {pages.length} pages from your formatted document. Tap a page to see it larger.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setZoomed(i)}
                  className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md"
                >
                  <div className="relative bg-white rounded-md overflow-hidden shadow-lg ring-1 ring-white/10 group-hover:ring-sky-400/60 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl(job.id, i + 1)} alt={pageLabel(i)} className="w-full h-auto block select-none" draggable={false} />
                    <Watermark />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">{pageLabel(i)}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-300 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            Your document was formatted, but we could not draw a preview of it. Create a free account to download it
            and open it in Word.
          </p>
        )}

        <p className="text-xs text-slate-500 mt-8">
          The preview is drawn by our server, so fonts and line breaks can differ slightly from Microsoft Word. Unclaimed
          documents are deleted after 48 hours.
        </p>
      </div>

      {zoomed !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-4"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-label={pageLabel(zoomed)}
        >
          <div className="relative max-h-[85vh] max-w-full overflow-auto bg-white rounded-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl(job.id, zoomed + 1)} alt={pageLabel(zoomed)} className="block max-w-[min(820px,100%)] h-auto select-none" draggable={false} />
            <Watermark />
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-200">
            <button disabled={zoomed === 0} onClick={(e) => { e.stopPropagation(); setZoomed(zoomed - 1); }} className="px-3 py-1.5 rounded-md bg-white/10 disabled:opacity-30">← Previous</button>
            <span>{pageLabel(zoomed)}</span>
            <button disabled={zoomed === pages.length - 1} onClick={(e) => { e.stopPropagation(); setZoomed(zoomed + 1); }} className="px-3 py-1.5 rounded-md bg-white/10 disabled:opacity-30">Next →</button>
            <button onClick={() => setZoomed(null)} className="px-3 py-1.5 rounded-md bg-white/10">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A diagonal "PREVIEW" mark over a page image. */
function Watermark() {
  return (
    <div className="@container pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
      <span className="-rotate-[35deg] whitespace-nowrap text-sky-700/15 font-bold tracking-[0.3em] text-[8cqw]">
        DOCSTUDIO PREVIEW
      </span>
    </div>
  );
}
