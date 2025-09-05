
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorOff, Settings, Users as UsersIcon, Phone, FileText, Landmark, Banknote, Wallet, History, Bell, Speaker, MenuSquare, ChevronRight, UserPlus } from 'lucide-react';
import type { Staff } from '@/lib/types';
import Link from 'next/link';
import { createLog } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const toolPageItems = [
    { href: "/admin/users", icon: UsersIcon, label: 'Manajemen Pengguna', id: 'users', roles: ['admin'] },
    { href: "/admin/staff", icon: UserPlus, label: 'Manajemen Staf', id: 'staff', roles: ['admin'] },
    { href: "/admin/announcements", icon: Speaker, label: 'Pengumuman', id: 'announcements', roles: ['admin'] },
    { href: "/admin/attendance", icon: Landmark, label: 'Kehadiran', id: 'attendance', roles: ['admin'] },
    { href: "/admin/dues", icon: Landmark, label: 'Iuran', id: 'dues', roles: ['admin', 'bendahara'] },
    { href: "/admin/honor", icon: Banknote, label: 'Honorarium', id: 'honor', roles: ['admin', 'bendahara'] },
    { href: "/admin/honor-saya", icon: Wallet, label: 'Honor Saya', id: 'honor-saya', roles: ['admin', 'bendahara'] },
    { href: "/admin/finance", icon: Wallet, label: 'Keuangan', id: 'finance', roles: ['admin', 'bendahara'] },
    { href: "/admin/activity-log", icon: History, label: 'Log Admin', id: 'activityLog', roles: ['admin'] },
    { href: "/admin/emergency-contacts", icon: Phone, label: 'Kontak Darurat', id: 'emergencyContacts', roles: ['admin'] },
    { href: "/admin/notifications", icon: Bell, label: 'Notifikasi', id: 'notifications', roles: ['admin'] },
];

export default function ToolsAdminPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) setCurrentAdmin(info);

    const settingsRef = doc(db, 'app_settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) setMaintenanceMode(docSnap.data().maintenanceMode || false);
        setLoadingMaintenance(false);
    });
    
    return () => {
        unsubSettings();
    };
  }, []);

  const handleMaintenanceToggle = async (checked: boolean) => {
    if (!currentAdmin) return;
    setLoadingMaintenance(true);
    try {
        const settingsRef = doc(db, 'app_settings', 'config');
        await setDoc(settingsRef, { maintenanceMode: checked }, { merge: true });
        await createLog(currentAdmin, `Mengubah Mode Pemeliharaan menjadi ${checked ? 'Aktif' : 'Tidak Aktif'}`);
        toast({ title: 'Berhasil', description: `Mode pemeliharaan telah di${checked ? 'aktifkan' : 'nonaktifkan'}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengubah status mode pemeliharaan.' });
        setMaintenanceMode(!checked); 
    } finally {
        setLoadingMaintenance(false);
    }
  }
  
  const { toast } = useToast();
  const isAdmin = currentAdmin?.role === 'admin';

  return (
    <div className="space-y-6">
       <h1 className="text-xl font-bold">Alat & Pengaturan</h1>
        
        <Card>
            <CardHeader>
                <CardTitle>Menu Alat</CardTitle>
                <CardDescription>Akses cepat ke semua fitur manajemen.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                 {toolPageItems
                    .filter(item => item.roles.includes(currentAdmin?.role || ''))
                    .map(item => (
                    <Link key={item.href} href={item.href} className="block hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <item.icon className="h-5 w-5 text-primary" />
                                <p className="font-medium">{item.label}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                    </Link>
                ))}
                </div>
            </CardContent>
        </Card>

        {isAdmin && (
             <>
                <Card>
                    <CardHeader>
                        <CardTitle>Pengaturan Aplikasi</CardTitle>
                        <CardDescription>Kelola pengaturan global untuk aplikasi.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                            <div className="flex items-center space-x-3">
                                <MonitorOff className="h-5 w-5 text-muted-foreground" />
                                <div className="space-y-0.5">
                                    <Label htmlFor="maintenance-mode">Mode Pemeliharaan</Label>
                                    <p className="text-xs text-muted-foreground">Arahkan semua traffic ke halaman maintenance.</p>
                                </div>
                            </div>
                            {loadingMaintenance ? <Skeleton className="h-6 w-10" /> : <Switch id="maintenance-mode" checked={maintenanceMode} onCheckedChange={handleMaintenanceToggle} />}
                        </div>
                    </CardContent>
                </Card>
            </>
        )}
    </div>
  );
}
