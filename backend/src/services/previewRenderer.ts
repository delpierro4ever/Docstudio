// backend/src/services/previewRenderer.ts
//
// Page images of a formatted document, shown to visitors before they
// sign up. scripts/render_preview.py does the work with a headless
// LibreOffice; renders run one at a time so a burst of visitors can't
// start many office processes at once.

import { execFile } from "child_process";
import path from "path";

import { Job } from "../models/job";
import { updateJob } from "../stores/jobStore";
import { previewsDir } from "./jobs";

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "render_preview.py");
const PYTHON = process.env.PREVIEW_PYTHON || "/usr/bin/python3";
const TIMEOUT_MS = 120_000;
export const PREVIEW_PAGES = 5;

let queue: Promise<unknown> = Promise.resolve();

function render(inputPath: string, outDir: string): Promise<{ pageCount: number; pages: number[] }> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      [SCRIPT, inputPath, outDir, String(PREVIEW_PAGES)],
      { timeout: TIMEOUT_MS, killSignal: "SIGKILL" },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr.trim() || err.message));
        try {
          resolve(JSON.parse(stdout.trim().split("\n").pop() || ""));
        } catch {
          reject(new Error(`unexpected renderer output: ${stdout.slice(0, 200)}`));
        }
      }
    );
  });
}

/**
 * Render preview images for a formatted job and record them on the job.
 * A failed render is logged and leaves the job without a preview; the
 * document itself is still fine to download.
 */
export function renderPreview(job: Job): Promise<void> {
  const run = queue.then(async () => {
    if (!job.outputPath) return;
    try {
      const { pageCount, pages } = await render(job.outputPath, path.join(previewsDir, job.id));
      updateJob(job.id, { pages: pageCount, previewPages: pages });
    } catch (err: any) {
      console.error(`Preview failed for job ${job.id}:`, err?.message || err);
      updateJob(job.id, { previewPages: [] });
    }
  });
  queue = run.catch(() => {});
  return run;
}

/** Path of preview image `n` (1-based) of a job, if in range. */
export function previewImagePath(job: Job, n: number): string | undefined {
  const count = job.previewPages?.length ?? 0;
  if (!Number.isInteger(n) || n < 1 || n > count) return undefined;
  return path.join(previewsDir, job.id, `${n}.png`);
}
