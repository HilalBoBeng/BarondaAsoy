import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateName(name: string): string {
  if (!name) return "";
  const words = name.split(' ');
  if (words.length > 2) {
    return `${words[0]} ${words[1]} ${words[2].charAt(0)}.`;
  }
  return name;
}
