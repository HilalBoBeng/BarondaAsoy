
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Phone, Megaphone, Bell, Banknote, ChevronRight } from 'lucide-react';
import type { Staff } from '@/lib/types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Badge } from '@/components/ui/badge';

const toolPageItems = [
    { href: "/petugas/patrol-log", icon: FileText, label: "Patroli & Log", id: "patrol-log" },
    { href: "/petugas/honor", icon: Banknote, label: "Honor Saya", id: "honor" },
    { href: "/petugas/announcements", icon: Megaphone, label: "Pengumuman", id: "announcements" },
    { href: "/petugas/notifications", icon: Bell, label: "Notifikasi", id: "notifications" },
    { href: "/petugas/emergency-contacts", icon: Phone, label: "Kontak Darurat", id: "emergency-contacts" },
];

export default function PetugasToolsPage() {
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
                <CardDescription>Akses cepat ke fitur-fitur tambahan.</CardDescription>
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
