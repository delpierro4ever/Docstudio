// backend/src/stores/jobStore.ts

import { Job } from "../models/job";

const jobs: Job[] = [];

export function addJob(job: Job): Job {
  jobs.push(job);
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
  return job;
}


// ... existing addJob, findJobsByUser, findJobById

export function findJobsByCenter(centerId: string): Job[] {
  return jobs.filter((j) => j.centerId === centerId);
}
