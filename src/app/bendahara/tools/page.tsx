
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorOff, Lock, Unlock, Settings, PlusCircle, User, Mail, Phone, MapPin, MoreVertical, Calendar, KeyRound, CheckCircle, Edit, ShieldAlert, FileText, ClipboardList, Landmark, Banknote, Wallet, History, Wrench, Bell, Link as LinkIcon, Users, UserCheck, MessageSquare } from 'lucide-react';
import type { Staff } from '@/lib/types';
import Link from 'next/link';
import { createLog } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const toolPageItems = [
    { href: "/bendahara/honor", icon: Banknote, label: 'Honorarium', id: 'honor' },
    { href: "/bendahara/notifications", icon: Bell, label: 'Notifikasi', id: 'notifications' },
];

export default function BendaharaToolsPage() {
  
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { toast } = useToast();

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info) setCurrentAdmin(info);

        if (info?.id) {
            const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', info.id), where('read', '==', false));
            const unsubNotifs = onSnapshot(notifsQuery, (snap) => setUnreadNotifications(snap.size));
            return () => {
                unsubNotifs();
            };
        }
    }, []);

  return (
    <div className="space-y-6">
        <h1 className="text-xl font-bold">Lainnya</h1>
        <Card>
            <CardHeader>
                <CardTitle>Menu Lainnya</CardTitle>
                <CardDescription>Akses cepat ke semua fitur manajemen bendahara.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {toolPageItems.map(item => (
                    <Link key={item.href} href={item.href} className="block">
                        <Card className="h-full hover:bg-muted transition-colors text-center flex flex-col items-center justify-center p-4 relative">
                             {item.id === 'notifications' && unreadNotifications > 0 && (
                                <Badge className="absolute top-2 right-2">{unreadNotifications}</Badge>
                            )}
                            <item.icon className="h-8 w-8 text-primary mb-2" />
                            <p className="text-sm font-semibold">{item.label}</p>
                        </Card>
                    </Link>
                ))}
            </CardContent>
        </Card>
    </div>
  );
}
