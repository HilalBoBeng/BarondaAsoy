
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/client';
import type { Staff } from './types';
import { useState, useEffect, useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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

// --- HOOK FOR SESSION TIMEOUT ---
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useInactivityTimeout() {
    const auth = getAuth();
    const router = useRouter();
    const { toast } = useToast();

    const logout = useCallback(() => {
        const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (staffInfo && staffInfo.id) {
             const staffDocRef = doc(db, 'staff', staffInfo.id);
             updateDoc(staffDocRef, { activeSessionId: null, loginRequest: null });
        }
        signOut(auth).then(() => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('staffInfo');
            localStorage.removeItem('activeSessionId');
            toast({
                title: 'Sesi Berakhir',
                description: 'Anda telah dikeluarkan karena tidak aktif.',
                variant: 'destructive'
            });
            router.push('/auth/staff-login');
        });
    }, [auth, router, toast]);

    useEffect(() => {
        let inactivityTimer: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(logout, INACTIVITY_TIMEOUT);
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll'];
        events.forEach(event => window.addEventListener(event, resetTimer));

        resetTimer(); 

        return () => {
            clearTimeout(inactivityTimer);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [logout]);
}
