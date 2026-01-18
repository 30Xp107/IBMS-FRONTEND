import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Simple cache for area data to avoid redundant network requests
export const areaCache = {
  cache: new Map(),
  get(key) {
    return this.cache.get(key);
  },
  set(key, value) {
    this.cache.set(key, value);
  },
  clear() {
    this.cache.clear();
  }
};
