import { useEffect } from "react";
import { useRouter } from "next/router";
import { getUserId } from "@/lib/auth";
import { apiFetch, errorMessage } from "@/lib/api";
import FormatForm from "@/components/FormatForm";

export default function UploadPage() {
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (!getUserId()) router.push("/login");
  }, [router]);

  async function upload(formData: FormData): Promise<string | null> {
    if (!getUserId()) { router.push("/login"); return null; }
    const res = await apiFetch("/documents", { method: "POST", body: formData });
    if (!res.ok) return errorMessage(res, "Failed to format document. Please try again.");
    const data: { job: { id: string } } = await res.json();
    router.push(`/dashboard/documents/${data.job.id}`);
    return null;
  }

  return (
    <FormatForm
      title="DocStudio · Upload"
      back={{ label: "Back to dashboard", onClick: () => router.push("/dashboard") }}
      onSubmit={upload}
    />
  );
}
