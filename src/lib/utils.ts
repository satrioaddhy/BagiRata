import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from "nanoid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an integer IDR amount for display.
 * Example: 150000 → "Rp 150.000"
 */
export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/**
 * Generate an unguessable short code for room URLs.
 * Uses a safe alphabet excluding ambiguous characters (0/O, l/1/I).
 * 8 chars ≈ 48 bits of entropy.
 */
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 8);

export function generateShortCode(): string {
  return nanoid();
}

/**
 * Sleep utility for retry backoff.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter.
 * Returns delay in ms for the given attempt number (0-indexed).
 */
export function backoffWithJitter(attempt: number, baseMs = 1000): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * exponential;
  return Math.min(exponential + jitter, 30000); // cap at 30s
}
