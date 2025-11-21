import { useState, FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { saveUserId } from "@/lib/auth";
import { useRouter } from "next/router";

interface LoginResponse {
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

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
          identifier,
          password,
        },
      });

      saveUserId(res.id);
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error(err);
      setError("Invalid email/phone or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left / Brand side */}
        <div className="md:w-1/2 bg-gradient-to-br from-sky-500/10 to-emerald-500/10 px-8 py-8 md:py-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-xl">
                A
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-sky-200">
                  Alita Automations
                </div>
                <h1 className="text-xl font-semibold text-white leading-tight">
                  DocStudio
                </h1>
              </div>
            </div>

            <h2 className="text-lg md:text-xl font-semibold text-white mb-2">
              Smart formatting for student reports.
            </h2>
            <p className="text-sm text-slate-200/80 mb-4">
              Upload your report, thesis or project, and let DocStudio handle
              the heavy formatting work — so you and documentation centers can
              focus on printing and submission.
            </p>

            <ul className="text-xs text-slate-200/80 space-y-1 mt-4">
              <li>• Automatic formatting profile (UB standard)</li>
              <li>• Basic justification & spacing already in place</li>
              <li>• Free quota for first documents</li>
            </ul>
          </div>

          <p className="text-[11px] text-slate-300/70 mt-6">
            © {new Date().getFullYear()} Alita Automations · DocStudio
          </p>
        </div>

        {/* Right / Form side */}
        <div className="md:w-1/2 bg-white px-6 md:px-8 py-8 md:py-10">
          <h2 className="text-2xl font-bold mb-2 text-slate-900">
            Welcome back
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Login with your email or phone number to access your documents.
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email or Phone
              </label>
              <input
                type="text"
                className="w-full border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-md px-3 py-2 text-sm outline-none transition"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="e.g. you@example.com or 67xxxxxxx"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-md px-3 py-2 text-sm outline-none transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-sky-700 disabled:opacity-60 disabled:hover:bg-sky-600 transition"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="text-xs text-slate-500 mt-4">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="text-sky-600 font-medium hover:underline"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
