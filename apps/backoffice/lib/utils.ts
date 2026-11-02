import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, the later Tailwind class winning a conflict (shadcn's helper). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
