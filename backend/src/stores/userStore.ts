// backend/src/stores/userStore.ts

import { User } from "../models/user";

const users: User[] = [];

// Find user by email or phone (for login)
export function findUserByIdentifier(identifier: string): User | undefined {
  return users.find(
    (u) => u.email === identifier || u.phone === identifier
  );
}

// Find user by ID (for documents route)
export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

// Find user by email (for registration uniqueness check)
export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

// Find user by phone (for registration uniqueness check)
export function findUserByPhone(phone: string): User | undefined {
  return users.find((u) => u.phone === phone);
}

// Save new user
export function addUser(user: User): User {
  users.push(user);
  return user;
}
