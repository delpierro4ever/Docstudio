import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

interface Props {
  /** Feedback about one formatted document; omit for general feedback. */
  jobId?: string;
  title?: string;
  prompt?: string;
}

/** Star rating + comment, posted to /feedback. */
export default function FeedbackForm({
  jobId,
  title = "How did it go?",
  prompt = "Rate the result and tell us what was right or wrong. It helps us improve DocStudio.",
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating && !comment.trim()) {
      setError("Please choose a rating or write a comment.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiRequest("/feedback", {
        method: "POST",
        body: { jobId, rating: rating ?? undefined, comment: comment.trim() || undefined },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Thank you! Your feedback was sent.
        <button
          type="button"
          onClick={() => { setSent(false); setRating(null); setComment(""); }}
          className="ml-2 underline text-emerald-200 hover:text-emerald-100"
        >
          Send more
        </button>
      </div>
    );
  }

  const shown = hover ?? rating ?? 0;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-400 mb-3">{prompt}</p>

      <div className="flex items-center gap-1 mb-3" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(rating === n ? null : n)}
            onMouseEnter={() => setHover(n)}
            className={`text-2xl leading-none transition ${n <= shown ? "text-amber-400" : "text-slate-600"} hover:scale-110`}
          >
            ★
          </button>
        ))}
        {rating && <span className="ml-2 text-xs text-slate-400">{rating}/5</span>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="What worked? What should be different?"
        className="w-full border border-slate-600 bg-slate-950/60 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
      />

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="mt-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition"
      >
        {sending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
