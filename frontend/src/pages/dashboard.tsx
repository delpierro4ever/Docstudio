import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiRequest } from "@/lib/api";
import { getUserId, logout } from "@/lib/auth";

interface MeResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  centerId: string | null;
  freeRemaining: number;
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

    apiRequest<MeResponse>("/auth/me", {
      headers: { "x-user-id": uid },
    })
      .then(setUser)
      .catch(() => {
        logout();
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>Loading...</p>
      </div>
    );
  }

  const isCenterAdmin = user.role === "center-admin";

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
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-500/20 text-sky-100 text-xs border border-sky-500/40">
                {isCenterAdmin ? "Documentation Center Admin" : "Individual User"}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">
                Free documents remaining
              </p>
              <p className="text-3xl font-semibold text-sky-300">
                {user.freeRemaining}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Once these are used, pricing per document applies.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Account type</p>
              <p className="text-lg font-semibold text-slate-100 capitalize">
                {user.role.replace("-", " ")}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isCenterAdmin
                  ? "You can upload and track jobs for your documentation center."
                  : "You can upgrade to a documentation center at any time."}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Quick info</p>
              <p className="text-sm text-slate-100">
                Profile: <span className="font-medium">UB Standard</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Basic formatting (justification & spacing) is active. Advanced
                formatting options will roll out in future versions.
              </p>
            </div>
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
                  View all the documents you've formatted and download the
                  final versions ready for printing.
                </p>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-100 group-hover:underline">
                Open documents →
              </p>
            </button>

            {/* Center / Upgrade */}
            {isCenterAdmin ? (
              <button
                onClick={() => router.push("/center")}
                className="group bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-4 text-left flex flex-col justify-between transition"
              >
                <div>
                  <p className="text-sm font-semibold mb-1">
                    Documentation Center Panel
                  </p>
                  <p className="text-xs text-purple-50/90">
                    Track all jobs processed through your center and monitor
                    usage.
                  </p>
                </div>
                <p className="mt-3 text-xs font-medium text-purple-50 group-hover:underline">
                  Open center dashboard →
                </p>
              </button>
            ) : (
              <button
                onClick={() => router.push("/center")}
                className="group bg-slate-900/70 hover:bg-slate-800 text-slate-50 rounded-xl px-4 py-4 text-left flex flex-col justify-between border border-slate-700 transition"
              >
                <div>
                  <p className="text-sm font-semibold mb-1">
                    Become a Documentation Center
                  </p>
                  <p className="text-xs text-slate-200/80">
                    Register your documentation center and format documents on
                    behalf of students.
                  </p>
                </div>
                <p className="mt-3 text-xs font-medium text-slate-100 group-hover:underline">
                  Setup center profile →
                </p>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
