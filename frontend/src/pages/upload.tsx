import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getUserId } from "@/lib/auth";

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

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<TextProfile[]>([]);
  const [profileId, setProfileId] = useState<string>(""); // auto-filled later
  const [documentType, setDocumentType] = useState("report");

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profiles from backend
  useEffect(() => {
    async function loadProfiles() {
      try {
        setLoadingProfiles(true);
        const res = await fetch("http://localhost:4000/profiles");
        const data = await res.json();

        setProfiles(data);

        // Auto-select first profile returned
        if (data.length > 0) {
          setProfileId(data[0].id);
        }

      } catch (err) {
        console.error(err);
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
    if (!uid) {
      router.push("/login");
      return;
    }

    if (!file) {
      setError("Please select a .docx file.");
      return;
    }

    if (!profileId) {
      setError("No formatting profile selected.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      formData.append("profileId", profileId);

      const res = await fetch("http://localhost:4000/documents", {
        method: "POST",
        headers: {
          "x-user-id": uid,
        },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Upload error:", text);
        setError("Failed to format document. Please try again.");
        return;
      }

      const data: CreateJobResponse = await res.json();

      // Redirect to preview page for this job
      router.push(`/dashboard/documents/${data.job.id}`);

    } catch (err) {
      console.error(err);
      setError("Failed to upload document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
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
            <span className="font-medium">DocStudio · Upload</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">
            Upload a document
          </h1>
          <p className="text-sm text-slate-200/80 mb-6">
            Select your student report or thesis in .docx format. DocStudio will
            apply the formatting rules and send you to the preview page automatically.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
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

            {/* Document type */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Document type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              >
                <option value="report">Student Report</option>
                <option value="undergraduate">Undergraduate Thesis</option>
                <option value="masters">Masters Thesis</option>
                <option value="phd">PhD Thesis</option>
              </select>
            </div>

            {/* Formatting profiles */}
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
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || loadingProfiles}
              className="mt-4 w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-60 transition"
            >
              {loading ? "Formatting your document…" : "Upload and format document"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
