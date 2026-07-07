// backend/src/stores/userStore.ts

import fs from "fs";
import path from "path";
import { User } from "../models/user";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as any[];
    // Rehydrate Date fields
    return parsed.map((u) => ({
      ...u,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    }));
  } catch {
    return [];
  }
}

function save(users: User[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("[userStore] Failed to persist users:", err);
  }
}

let users: User[] = load();

export function findUserByIdentifier(identifier: string): User | undefined {
  return users.find(
    (u) => u.email === identifier || u.phone === identifier
  );
}

export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

export function findUserByPhone(phone: string): User | undefined {
  return users.find((u) => u.phone === phone);
}

export function addUser(user: User): User {
  users.push(user);
  save(users);
  return user;
}

export function saveUser(user: User): void {
  save(users);
}
