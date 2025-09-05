
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Phone, Megaphone, Bell, Banknote, User as UserIcon, Wrench } from 'lucide-react';
import type { Staff } from '@/lib/types';

const toolPageItems = [
    { href: "/petugas/patrol-log", icon: FileText, label: "Patroli & Log" },
    { href: "/petugas/honor", icon: Banknote, label: "Honor Saya" },
    { href: "/petugas/announcements", icon: Megaphone, label: "Pengumuman" },
    { href: "/petugas/notifications", icon: Bell, label: "Notifikasi" },
    { href: "/petugas/emergency-contacts", icon: Phone, label: "Kontak Darurat" },
];

export default function PetugasToolsPage() {
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info) setCurrentAdmin(info);
    }, []);

  return (
    <div className="space-y-6">
        <h1 className="text-xl font-bold">Lainnya</h1>
        <Card>
            <CardHeader>
                <CardTitle>Menu Lainnya</CardTitle>
                <CardDescription>Akses cepat ke fitur-fitur tambahan.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {toolPageItems.map(item => (
                    <Link key={item.href} href={item.href} className="block">
                        <Card className="h-full hover:bg-muted transition-colors text-center flex flex-col items-center justify-center p-4">
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
