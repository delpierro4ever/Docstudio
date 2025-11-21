// backend/src/stores/centerStore.ts

import { Center } from "../models/center";

const centers: Center[] = [];

export function addCenter(center: Center): Center {
  centers.push(center);
  return center;
}

export function findCenterById(id: string): Center | undefined {
  return centers.find((c) => c.id === id);
}

export function findCentersByOwner(ownerUserId: string): Center[] {
  return centers.filter((c) => c.ownerUserId === ownerUserId);
}
