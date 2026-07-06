import { useEffect } from "react";
import { useRouter } from "next/router";
import { getUserId } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const uid = getUserId();
    router.push(uid ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <p>Redirecting to DocStudio...</p>
    </div>
  );
}
