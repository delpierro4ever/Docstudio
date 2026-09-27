import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiRequest } from "@/lib/api";
import { getUserId, logout } from "@/lib/auth";
import FeedbackForm from "@/components/FeedbackForm";

interface MeResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  centerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    apiRequest<MeResponse>("/auth/me")
      .then(setUser)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200">
                Alita Automations
              </p>
              <p className="text-sm font-semibold text-white">DocStudio</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-100 font-medium">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-300">
                {user.email || user.phone}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-red-300 hover:text-red-200 underline"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 md:p-8">
          {/* Greeting & subtitle */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">
                Hi {user.fullName.split(" ")[0]}, welcome back 👋
              </h1>
              <p className="text-sm text-slate-200/80 mt-1">
                Manage your formatted documents and send them to print with
                confidence.
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-xs border border-emerald-500/40">
                Free testing period
              </span>
            </div>
          </div>

          {/* Testing notice */}
          <div className="mb-8 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            DocStudio is <span className="font-semibold">free</span> while we test it. Format as many documents
            as you need and tell us what works and what doesn&apos;t using the feedback form below
            or on each document&apos;s page.
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upload */}
            <button
              onClick={() => router.push("/upload")}
              className="group bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-4 py-4 text-left flex flex-col justify-between transition"
            >
              <div>
                <p className="text-sm font-semibold mb-1">
                  Upload & Format Document
                </p>
                <p className="text-xs text-sky-100/80">
                  Upload your report or thesis as a .docx and let DocStudio
                  format it for you automatically.
                </p>
              </div>
              <p className="mt-3 text-xs font-medium text-sky-100 group-hover:underline">
                Go to upload →
              </p>
            </button>

            {/* My Documents */}
            <button
              onClick={() => router.push("/documents")}
              className="group bg-slate-900/70 hover:bg-slate-800 text-slate-50 rounded-xl px-4 py-4 text-left flex flex-col justify-between border border-slate-700 transition"
            >
              <div>
                <p className="text-sm font-semibold mb-1">My Documents</p>
                <p className="text-xs text-slate-200/80">
                  View all the documents you&apos;ve formatted and download the
                  final versions ready for printing.
                </p>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-100 group-hover:underline">
                Open documents →
              </p>
            </button>

            {/* Feedback */}
            <a
              href="#feedback"
              className="group bg-slate-900/70 hover:bg-slate-800 text-slate-50 rounded-xl px-4 py-4 text-left flex flex-col justify-between border border-slate-700 transition"
            >
              <div>
                <p className="text-sm font-semibold mb-1">Send Feedback</p>
                <p className="text-xs text-slate-200/80">
                  Found a problem or have an idea? Tell us. We read every message.
                </p>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-100 group-hover:underline">
                Write feedback →
              </p>
            </a>
          </div>

          <div id="feedback" className="mt-8 scroll-mt-6">
            <FeedbackForm
              title="Tell us what you think"
              prompt="General feedback about DocStudio: problems, ideas, or what you'd pay for later."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
