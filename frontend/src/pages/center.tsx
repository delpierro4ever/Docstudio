import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiRequest } from "@/lib/api";
import { getUserId } from "@/lib/auth";

interface MeResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "individual" | "center-admin" | "center-staff" | string;
  centerId: string | null;
  freeRemaining: number;
  createdAt: string;
  updatedAt: string;
}

interface Center {
  id: string;
  name: string;
  phone: string;
  address?: string;
  email?: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CenterMeResponse {
  center: Center;
  role: string;
}

interface CenterJob {
  id: string;
  documentType: string;
  profileId: string;
  status: string;
  isFree: boolean;
  priceCfa?: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateCenterResponse {
  message: string;
  center: Center;
  user: MeResponse;
}

export default function CenterPage() {
  const router = useRouter();

  const [user, setUser] = useState<MeResponse | null>(null);
  const [center, setCenter] = useState<Center | null>(null);
  const [jobs, setJobs] = useState<CenterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingCenter, setCreatingCenter] = useState(false);

  const [centerName, setCenterName] = useState("");
  const [centerPhone, setCenterPhone] = useState("");
  const [centerAddress, setCenterAddress] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    async function loadUserAndCenter(userId: string) {
      try {
        // 1) Load user
        const me = await apiRequest<MeResponse>("/auth/me", {
          headers: { "x-user-id": userId },
        });
        setUser(me);
        setCenterPhone(me.phone);

        // 2) If user has center, load center info & jobs
        if (me.centerId) {
          const cRes = await apiRequest<CenterMeResponse>("/centers/me", {
            headers: { "x-user-id": userId },
          });
          setCenter(cRes.center);

          const jobsRes = await apiRequest<CenterJob[]>("/centers/me/jobs", {
            headers: { "x-user-id": userId },
          });
          setJobs(jobsRes);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load center information.");
      } finally {
        setLoading(false);
      }
    }

    loadUserAndCenter(uid);
  }, [router]);

  async function handleCreateCenter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");

    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    if (!centerName.trim()) {
      setError("Center name is required.");
      return;
    }

    setCreatingCenter(true);
    try {
      const res = await apiRequest<CreateCenterResponse>("/centers", {
        method: "POST",
        body: {
          name: centerName,
          phone: centerPhone || user?.phone,
          address: centerAddress,
        },
        headers: { "x-user-id": uid },
      });

      setCenter(res.center);
      setUser(res.user);
      setInfo("Center created successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to create center.");
    } finally {
      setCreatingCenter(false);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function docTypeLabel(type: string) {
    switch (type) {
      case "report":
        return "Student Report";
      case "undergraduate":
        return "Undergraduate Thesis";
      case "masters":
        return "Masters Thesis";
      case "phd":
        return "PhD Thesis";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-200 text-sm">Loading center dashboard…</p>
      </div>
    );
  }

  if (!user) return null;

  const isCenterAdmin = user.role === "center-admin";

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
            <span className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">
              C
            </span>
            <span className="font-medium">
              DocStudio · Documentation Center
            </span>
          </div>
        </div>

        {/* ...rest of your component stays exactly the same... */}
        {/* I won't repeat it here since nothing else changes */}
      </div>
    </div>
  );
}
