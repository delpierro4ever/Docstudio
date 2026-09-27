// backend/src/stores/centerStore.ts

import fs from "fs";
import path from "path";
import { Center } from "../models/center";
import { DATA_DIR } from "../config/paths";

const CENTERS_FILE = path.join(DATA_DIR, "centers.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Center[] {
  try {
    if (!fs.existsSync(CENTERS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(CENTERS_FILE, "utf-8")) as any[];
    return parsed.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    }));
  } catch {
    return [];
  }
}

const centers: Center[] = load();

export function addCenter(center: Center): Center {
  centers.push(center);
  try {
    fs.writeFileSync(CENTERS_FILE, JSON.stringify(centers, null, 2), "utf-8");
  } catch (err) {
    console.error("[centerStore] Failed to persist centers:", err);
  }
  return center;
}

export function findCenterById(id: string): Center | undefined {
  return centers.find((c) => c.id === id);
}

export function findCentersByOwner(ownerUserId: string): Center[] {
  return centers.filter((c) => c.ownerUserId === ownerUserId);
}
