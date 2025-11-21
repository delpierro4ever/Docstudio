// backend/src/models/center.ts

export interface Center {
  id: string;
  name: string;
  phone: string;
  address?: string;
  email: string;

  ownerUserId: string;  // the center-admin user

  createdAt: Date;
  updatedAt: Date;
}
