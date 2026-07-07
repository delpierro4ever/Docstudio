import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getUserId } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

interface TextProfile {
  id: string;
  name: string;
  description: string;
}

interface CreateJobResponse {
  message: string;
  job: {
    id: string;
    documentType: string;
    profileId: string;
    status: string;
    isFree: boolean;
    priceCfa?: number;
    createdAt: string;
    updatedAt: string;
  };
}

type Mode = "full" | "quick";

const FULL_DOC_TYPES = [
  { value: "report", label: "Student Report" },
  { value: "undergraduate", label: "Undergraduate Thesis" },
  { value: "masters", label: "Masters Thesis" },
  { value: "phd", label: "PhD Thesis" },
];

export default function UploadPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<TextProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [documentType, setDocumentType] = useState("report");

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!getUserId()) router.push("/login");
  }, [router]);

  // Load profiles from backend
  useEffect(() => {
    async function loadProfiles() {
      try {
        setLoadingProfiles(true);
        const res = await fetch(`${API_BASE}/profiles`);
        const data = await res.json();
        setProfiles(data);
        if (data.length > 0) setProfileId(data[0].id);
      } catch {
        setError("Failed to load formatting profiles.");
      } finally {
        setLoadingProfiles(false);
      }
    }
    loadProfiles();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const uid = getUserId();
    if (!uid) { router.push("/login"); return; }

    if (!file) { setError("Please select a .docx file."); return; }
    if (!profileId) { setError("No formatting profile selected."); return; }

    const finalDocType = mode === "quick" ? "print_ready" : documentType;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", finalDocType);
      formData.append("profileId", profileId);

      const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: { "x-user-id": uid },
        body: formData,
      });

      if (!res.ok) {
        setError("Failed to format document. Please try again.");
        return;
      }

      const data: CreateJobResponse = await res.json();
      router.push(`/dashboard/documents/${data.job.id}`);
    } catch {
      setError("Failed to upload document.");
    } finally {
      setLoading(false);
    }
  }

  // Mode selection screen
  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-sky-200 hover:text-sky-100 underline"
            >
              ← Back to dashboard
            </button>
            <div className="flex items-center gap-2 text-sky-100 text-sm">
              <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">A</span>
              <span className="font-medium">DocStudio · Upload</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2 text-center">
            What do you need?
          </h1>
          <p className="text-sm text-slate-300 mb-8 text-center">
            Choose the type of formatting you want for your document.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full format */}
            <button
              onClick={() => setMode("full")}
              className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sky-400/40 rounded-2xl p-6 transition-all shadow-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">📄</span>
                <h2 className="text-lg font-semibold text-white">Full Thesis Format</h2>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                Complete academic formatting for theses and formal reports. Includes:
              </p>
              <ul className="text-xs text-slate-400 space-y-1 mb-4">
                <li>✓ Table of Contents</li>
                <li>✓ List of Tables &amp; Figures</li>
                <li>✓ List of Abbreviations</li>
                <li>✓ Figure &amp; table caption numbering</li>
                <li>✓ Roman + Arabic page numbering</li>
                <li>✓ Font, spacing &amp; heading styles</li>
              </ul>
              <span className="inline-block bg-sky-600 group-hover:bg-sky-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
                Choose Full Format →
              </span>
            </button>

            {/* Quick format */}
            <button
              onClick={() => setMode("quick")}
              className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/40 rounded-2xl p-6 transition-all shadow-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🖨️</span>
                <h2 className="text-lg font-semibold text-white">Quick Print Format</h2>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                Light formatting for reports you just need to print. Includes:
              </p>
              <ul className="text-xs text-slate-400 space-y-1 mb-4">
                <li>✓ Font &amp; font size</li>
                <li>✓ Line spacing &amp; paragraph style</li>
                <li>✓ Page margins</li>
                <li>✓ Heading styles</li>
                <li>✓ Page numbering</li>
                <li className="text-slate-500">✗ No preliminary pages</li>
              </ul>
              <span className="inline-block bg-emerald-600 group-hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
                Choose Quick Format →
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isQuick = mode === "quick";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setMode(null); setError(null); setFile(null); }}
            className="text-xs text-sky-200 hover:text-sky-100 underline"
          >
            ← Change format type
          </button>
          <div className="flex items-center gap-2 text-sky-100 text-sm">
            <span className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">A</span>
            <span className="font-medium">DocStudio · Upload</span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{isQuick ? "🖨️" : "📄"}</span>
            <h1 className="text-2xl font-semibold text-white">
              {isQuick ? "Quick Print Format" : "Full Thesis Format"}
            </h1>
          </div>
          <p className="text-sm text-slate-300 mb-6">
            {isQuick
              ? "Upload your report and we will apply font, spacing, margins, heading styles and page numbers — nothing more."
              : "Upload your thesis or report for complete academic formatting including all preliminary pages."}
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* File */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Document file (.docx)
              </label>
              <input
                type="file"
                accept=".docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-100
                  file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0
                  file:text-xs file:font-medium file:bg-sky-600 file:text-white hover:file:bg-sky-700
                  bg-slate-900/60 border border-slate-600 rounded-md"
              />
            </div>

            {/* Document type — only for full format */}
            {!isQuick && (
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Document type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                >
                  {FULL_DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Formatting profile */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Formatting profile
              </label>
              {loadingProfiles ? (
                <p className="text-slate-300 text-xs">Loading profiles…</p>
              ) : (
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || loadingProfiles}
              className={`mt-4 w-full text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-60 transition ${
                isQuick
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              {loading
                ? "Formatting your document…"
                : isQuick
                  ? "Upload and quick-format document"
                  : "Upload and format document"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
