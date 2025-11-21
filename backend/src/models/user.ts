// backend/src/models/user.ts

export type UserRole = "individual" | "center-admin" | "center-staff";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;

  role: UserRole;       // 👈 new
  centerId?: string;    // 👈 new (if they belong to a center)

  freeRemaining: number;
  createdAt: Date;
  updatedAt: Date;
}
