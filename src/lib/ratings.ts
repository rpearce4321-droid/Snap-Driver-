// src/lib/ratings.ts

import { readStoreData, writeStore } from "./storage";

export type RetainerRating = {
  id: string;
  retainerId: string;
  seekerId?: string;
  stars: number; // 1-5
  comment?: string;
  createdAt: string; // ISO string
};

const RETAINER_RATINGS_KEY = "snapdriver_retainer_ratings_v1";
const RETAINER_RATINGS_SCHEMA_VERSION = 1;

function loadAllRetainerRatings(): RetainerRating[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<unknown>(RETAINER_RATINGS_KEY);
  return Array.isArray(parsed) ? (parsed as RetainerRating[]) : [];
}

function saveAllRetainerRatings(list: RetainerRating[]) {
  if (typeof window === "undefined") return;
  try {
    writeStore(RETAINER_RATINGS_KEY, RETAINER_RATINGS_SCHEMA_VERSION, list);
  } catch {
    // ignore
  }
}

function generateId() {
  return `rating_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function addRetainerRating(input: {
  retainerId: string;
  seekerId?: string;
  stars: number;
  comment?: string;
}): RetainerRating {
  if (!input.retainerId) {
    throw new Error("retainerId is required to add a rating");
  }

  // Clamp / normalize stars between 1 and 5
  const normalizedStars = Math.min(5, Math.max(1, Math.round(input.stars)));

  const rating: RetainerRating = {
    id: generateId(),
    retainerId: input.retainerId,
    seekerId: input.seekerId,
    stars: normalizedStars,
    comment: input.comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const all = loadAllRetainerRatings();
  all.push(rating);
  saveAllRetainerRatings(all);

  return rating;
}

export function getRatingsForRetainer(retainerId: string): RetainerRating[] {
  if (!retainerId) return [];
  const all = loadAllRetainerRatings();
  return all.filter((r) => r.retainerId === retainerId);
}

export function getRetainerRatingSummary(retainerId: string): {
  avg: number;
  count: number;
} {
  const ratings = getRatingsForRetainer(retainerId);
  if (ratings.length === 0) {
    return { avg: 0, count: 0 };
  }
  const sum = ratings.reduce((acc, r) => acc + (r.stars || 0), 0);
  return {
    avg: sum / ratings.length,
    count: ratings.length,
  };
}

// Optional helper if you ever want to wipe ratings for a given Retainer
export function clearRetainerRatings(retainerId: string) {
  const all = loadAllRetainerRatings();
  const next = all.filter((r) => r.retainerId !== retainerId);
  saveAllRetainerRatings(next);
}

