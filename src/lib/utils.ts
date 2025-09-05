
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/client';
import type { Staff } from './types';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateName(name?: string | null): string {
  if (!name) return "";
  const words = name.split(' ');
  if (words.length > 2) {
    return `${words[0]} ${words[1].charAt(0)}.`;
  }
  return name;
}

export async function createLog(admin: Staff, action: string) {
    if (!admin) return;
    try {
        await addDoc(collection(db, 'admin_logs'), {
            adminId: admin.id,
            adminName: admin.name,
            action: action,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create log:", error);
    }
}
