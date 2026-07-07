// backend/src/stores/jobStore.ts

import fs from "fs";
import path from "path";
import { Job } from "../models/job";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Job[] {
  try {
    if (!fs.existsSync(JOBS_FILE)) return [];
    const raw = fs.readFileSync(JOBS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as any[];
    return parsed.map((j) => ({
      ...j,
      createdAt: new Date(j.createdAt),
      updatedAt: new Date(j.updatedAt),
    }));
  } catch {
    return [];
  }
}

function save(jobs: Job[]): void {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf-8");
  } catch (err) {
    console.error("[jobStore] Failed to persist jobs:", err);
  }
}

let jobs: Job[] = load();

export function addJob(job: Job): Job {
  jobs.push(job);
  save(jobs);
  return job;
}

export function findJobsByUser(userId: string): Job[] {
  return jobs.filter((j) => j.userId === userId);
}

export function findJobById(id: string): Job | undefined {
  return jobs.find((j) => j.id === id);
}

export function updateJob(id: string, data: Partial<Job>): Job | undefined {
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  Object.assign(job, data);
  job.updatedAt = new Date();
  save(jobs);
  return job;
}

export function findJobsByCenter(centerId: string): Job[] {
  return jobs.filter((j) => j.centerId === centerId);
}
