import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getUserId } from "@/lib/auth";
import { apiFetch, errorMessage } from "@/lib/api";
import { Category, CATEGORY_DOC_TYPE, THESIS_LEVELS } from "@/lib/documentTypes";

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
    createdAt: string;
    updatedAt: string;
  };
}

// Tailwind needs literal class names, so each category spells out its own.
const CATEGORIES: Record<Category, {
  icon: string;
  title: string;
  summary: string;
  intro: string;
  includes: string[];
  excludes: string[];
  cardHover: string;
  button: string;
  submitLabel: string;
}> = {
  thesis: {
    icon: "🎓",
    title: "Thesis",
    summary: "Complete academic formatting for undergraduate, masters and PhD theses.",
    intro: "Upload your thesis for complete academic formatting, including all preliminary pages.",
    includes: [
      "Table of Contents",
      "List of Tables & Figures",
      "List of Abbreviations",
      "Figure & table caption numbering",
      "Roman (i, ii) + Arabic (1, 2) page numbers",
      "Grammar & spelling corrections",
      "Font, spacing & heading styles",
    ],
    excludes: [],
    cardHover: "hover:border-sky-400/40",
    button: "bg-sky-600 hover:bg-sky-700",
    submitLabel: "Upload and format thesis",
  },
  report: {
    icon: "📄",
    title: "Report",
    summary: "For reports that need clean formatting and corrections, without preliminary pages.",
    intro: "Upload your report and we will fix fonts, spacing, headings, captions, grammar and page numbers.",
    includes: [
      "Font, spacing & heading styles",
      "Grammar & spelling corrections",
      "Figure & table caption numbering",
      "Page numbers 1, 2, 3…",
    ],
    excludes: ["No table of contents or lists"],
    cardHover: "hover:border-violet-400/40",
    button: "bg-violet-600 hover:bg-violet-700",
    submitLabel: "Upload and format report",
  },
  quick: {
    icon: "🖨️",
    title: "Quick Format",
    summary: "Layout only, for documents that are ready and just need to look right for printing.",
    intro: "Upload your document and we will apply font, spacing, margins, heading styles and page numbers. Your text is not changed.",
    includes: [
      "Font & font size",
      "Line spacing & paragraph style",
      "Page margins",
      "Heading styles",
      "Page numbers 1, 2, 3…",
    ],
    excludes: ["No grammar changes: text left as is"],
    cardHover: "hover:border-emerald-400/40",
    button: "bg-emerald-600 hover:bg-emerald-700",
    submitLabel: "Upload and quick-format document",
  },
};

export default function UploadPage() {
  const router = useRouter();

  const [category, setCategory] = useState<Category | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<TextProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [thesisLevel, setThesisLevel] = useState(THESIS_LEVELS[0].value);

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
        const res = await apiFetch("/profiles");
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

    if (!getUserId()) { router.push("/login"); return; }

    if (!file) { setError("Please select a .docx file."); return; }
    if (!profileId) { setError("No formatting profile selected."); return; }

    if (!category) return;
    const finalDocType = category === "thesis" ? thesisLevel : CATEGORY_DOC_TYPE[category];

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", finalDocType);
      formData.append("profileId", profileId);

      const res = await apiFetch("/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError(await errorMessage(res, "Failed to format document. Please try again."));
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
  if (!category) {
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(CATEGORIES) as Category[]).map((key) => {
              const c = CATEGORIES[key];
              return (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`group text-left bg-white/5 hover:bg-white/10 border border-white/10 ${c.cardHover} rounded-2xl p-6 transition-all shadow-xl flex flex-col`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{c.icon}</span>
                    <h2 className="text-lg font-semibold text-white">{c.title}</h2>
                  </div>
                  <p className="text-sm text-slate-300 mb-4">{c.summary}</p>
                  <ul className="text-xs text-slate-400 space-y-1 mb-4 flex-1">
                    {c.includes.map((item) => <li key={item}>✓ {item}</li>)}
                    {c.excludes.map((item) => <li key={item} className="text-slate-500">✗ {item}</li>)}
                  </ul>
                  <span className={`self-start inline-block ${c.button} text-white text-xs font-medium px-3 py-1.5 rounded-lg transition`}>
                    Choose {c.title} →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const current = CATEGORIES[category];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setCategory(null); setError(null); setFile(null); }}
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
            <span className="text-2xl">{current.icon}</span>
            <h1 className="text-2xl font-semibold text-white">{current.title}</h1>
          </div>
          <p className="text-sm text-slate-300 mb-6">{current.intro}</p>

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

            {/* Thesis level (affects pricing only) */}
            {category === "thesis" && (
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Thesis level
                </label>
                <select
                  value={thesisLevel}
                  onChange={(e) => setThesisLevel(e.target.value)}
                  className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                >
                  {THESIS_LEVELS.map((t) => (
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
              className={`mt-4 w-full text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-60 transition ${current.button}`}
            >
              {loading ? "Formatting your document…" : current.submitLabel}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
