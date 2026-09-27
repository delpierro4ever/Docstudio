import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { docTypeLabel } from "@/lib/documentTypes";

// Operator view for the testing period: usage, failures and feedback.
// Needs the backend's ADMIN_KEY; the key is kept in sessionStorage only.

interface Person { name: string; email: string; phone: string }

interface Overview {
  generatedAt: string;
  totals: { users: number; jobs: number; feedback: number; averageRating: number | null };
  jobsByType: Record<string, number>;
  jobsByStatus: Record<string, number>;
  signupsByDay: Record<string, number>;
  jobsByDay: Record<string, number>;
  feedback: {
    id: string;
    createdAt: string;
    rating: number | null;
    comment: string | null;
    user: Person | null;
    job: { id: string; documentType: string; originalName: string | null; status: string } | null;
  }[];
  recentFailures: {
    id: string;
    at: string;
    documentType: string;
    originalName: string | null;
    errorMessage: string | null;
    user: Person | null;
  }[];
  users: (Person & { joined: string; documents: number })[];
}

const KEY_STORAGE = "docstudioAdminKey";

function fmt(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-sky-300">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Counts({ data, label = (k: string) => k }: { data: Record<string, number>; label?: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-sm text-slate-400">None yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <span key={k} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-100">
          {label(k)}: <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/overview`, { headers: { "x-admin-key": adminKey } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
      try { sessionStorage.setItem(KEY_STORAGE, adminKey); } catch {}
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load");
      try { sessionStorage.removeItem(KEY_STORAGE); } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(KEY_STORAGE); } catch {}
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, [load]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (key.trim()) load(key.trim());
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6 text-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">DocStudio · Admin</h1>
          {data && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Updated {fmt(data.generatedAt)}</span>
              <button onClick={() => load(key)} className="underline text-sky-300 hover:text-sky-200">
                Refresh
              </button>
            </div>
          )}
        </div>

        {!data && (
          <form onSubmit={handleSubmit} className="max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
            <label className="block text-xs font-medium text-slate-200 mb-1">Admin key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full border border-slate-600 bg-slate-900/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-md text-sm font-medium"
            >
              {loading ? "Loading…" : "Open dashboard"}
            </button>
          </form>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card label="Users" value={data.totals.users} />
              <Card label="Documents" value={data.totals.jobs} />
              <Card label="Feedback" value={data.totals.feedback} />
              <Card label="Average rating" value={data.totals.averageRating ?? "–"} />
            </div>

            <Section title="Documents">
              <div className="space-y-3">
                <Counts data={data.jobsByType} label={docTypeLabel} />
                <Counts data={data.jobsByStatus} />
              </div>
            </Section>

            <Section title={`Feedback (${data.feedback.length})`}>
              {data.feedback.length === 0 ? (
                <p className="text-sm text-slate-400">No feedback yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.feedback.map((f) => (
                    <div key={f.id} className="bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-1">
                        {f.rating !== null && (
                          <span className="text-amber-400 text-sm">
                            {"★".repeat(f.rating)}<span className="text-slate-600">{"★".repeat(5 - f.rating)}</span>
                          </span>
                        )}
                        <span>{f.user ? `${f.user.name} · ${f.user.email} · ${f.user.phone}` : "Unknown user"}</span>
                        <span>{fmt(f.createdAt)}</span>
                        <span>
                          {f.job
                            ? `${docTypeLabel(f.job.documentType)}: ${f.job.originalName || f.job.id.slice(0, 8)}`
                            : "General feedback"}
                        </span>
                      </div>
                      {f.comment && <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{f.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Failed documents (${data.recentFailures.length})`}>
              {data.recentFailures.length === 0 ? (
                <p className="text-sm text-slate-400">No failures.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-slate-300 border-b border-slate-700">
                        <th className="py-2 pr-3">When</th>
                        <th className="py-2 pr-3">File</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentFailures.map((f) => (
                        <tr key={f.id} className="border-b border-slate-800 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">{fmt(f.at)}</td>
                          <td className="py-2 pr-3 break-all">{f.originalName || f.id.slice(0, 8)}</td>
                          <td className="py-2 pr-3">{docTypeLabel(f.documentType)}</td>
                          <td className="py-2 pr-3">{f.user?.email || "?"}</td>
                          <td className="py-2 text-red-300">{f.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title={`Users (${data.users.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-slate-300 border-b border-slate-700">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Phone</th>
                      <th className="py-2 pr-3">Joined</th>
                      <th className="py-2">Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.email} className="border-b border-slate-800">
                        <td className="py-2 pr-3">{u.name}</td>
                        <td className="py-2 pr-3 break-all">{u.email}</td>
                        <td className="py-2 pr-3">{u.phone}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmt(u.joined)}</td>
                        <td className="py-2">{u.documents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
