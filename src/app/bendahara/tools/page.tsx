
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Banknote, Bell, ChevronRight } from 'lucide-react';
import type { Staff } from '@/lib/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const toolPageItems = [
    { href: "/bendahara/honor", icon: Banknote, label: 'Honorarium', id: 'honor' },
    { href: "/bendahara/notifications", icon: Bell, label: 'Notifikasi', id: 'notifications' },
];

export default function BendaharaToolsPage() {
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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
            <CardContent className="p-0">
                <div className="divide-y">
                     {toolPageItems.map(item => (
                        <Link key={item.href} href={item.href} className="block hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <item.icon className="h-5 w-5 text-primary" />
                                    <p className="font-medium">{item.label}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.id === 'notifications' && unreadNotifications > 0 && (
                                        <Badge>{unreadNotifications}</Badge>
                                    )}
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
