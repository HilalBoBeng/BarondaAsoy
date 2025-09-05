
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorOff, Lock, Unlock, Settings, PlusCircle, User, Mail, Phone, MapPin, MoreVertical, Calendar, KeyRound, CheckCircle, Edit, ShieldAlert, FileText, ClipboardList, Landmark, Banknote, Wallet, History, Wrench } from 'lucide-react';
import type { Staff } from '@/lib/types';
import Link from 'next/link';
import { createLog } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';

interface MenuConfig {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

const getInitialMenuState = (role: 'petugas' | 'bendahara'): Omit<MenuConfig, 'visible' | 'locked'>[] => {
    const allMenus = [
        { id: 'dashboard', label: 'Dasbor', roles: ['petugas', 'bendahara'] },
        { id: 'profile', label: 'Profil Saya', roles: ['petugas', 'bendahara'] },
        { id: 'reports', label: 'Laporan Warga', roles: ['petugas'] },
        { id: 'schedule', label: 'Jadwal Saya', roles: ['petugas'] },
        { id: 'patrolLog', label: 'Patroli & Log', roles: ['petugas'] },
        { id: 'honor', label: 'Honor Saya', roles: ['petugas', 'bendahara'] },
        { id: 'announcements', label: 'Pengumuman', roles: ['petugas'] },
        { id: 'notifications', label: 'Notifikasi', roles: ['petugas', 'bendahara'] },
        { id: 'emergencyContacts', label: 'Kontak Darurat', roles: ['petugas'] },
        { id: 'tools', label: 'Lainnya', roles: ['petugas'] },
        { id: 'dues', label: 'Iuran Warga', roles: ['bendahara'] },
        { id: 'finance', label: 'Keuangan', roles: ['bendahara'] },
    ];
    return allMenus.filter(menu => menu.roles.includes(role)).map(({ roles, ...rest }) => rest);
};

const toolPageItems = [
    { href: "/admin/reports", icon: ShieldAlert, label: 'Laporan Warga', id: 'reports', roles: ['admin'] },
    { href: "/admin/announcements", icon: FileText, label: 'Pengumuman', id: 'announcements', roles: ['admin'] },
    { href: "/admin/attendance", icon: ClipboardList, label: 'Kehadiran', id: 'attendance', roles: ['admin'] },
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
  
  const [petugasMenuConfig, setPetugasMenuConfig] = useState<MenuConfig[]>([]);
  const [bendaharaMenuConfig, setBendaharaMenuConfig] = useState<MenuConfig[]>([]);
  const [loadingMenuConfig, setLoadingMenuConfig] = useState(true);

  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  
  const { toast } = useToast();

  const loadMenuConfig = useCallback(async (role: 'petugas' | 'bendahara') => {
        const docId = `${role}_menu`;
        const menuConfigRef = doc(db, 'app_settings', docId);
        const initialMenuState = getInitialMenuState(role);

        const docSnap = await getDoc(menuConfigRef);
        const savedConfig = docSnap.exists() ? docSnap.data().config : [];
        let configChanged = false;

        const mergedConfig = initialMenuState.map(initialItem => {
            const savedItem = savedConfig.find((d: MenuConfig) => d.id === initialItem.id);
            if (savedItem) return { ...initialItem, ...savedItem };
            configChanged = true;
            return { ...initialItem, visible: true, locked: false };
        });

        const dashboardItem = mergedConfig.find(item => item.id === 'dashboard');
        if (dashboardItem) {
            if (!dashboardItem.visible || dashboardItem.locked) {
                dashboardItem.visible = true;
                dashboardItem.locked = false;
                configChanged = true;
            }
        }
        
        if (role === 'petugas') setPetugasMenuConfig(mergedConfig);
        if (role === 'bendahara') setBendaharaMenuConfig(mergedConfig);

        if (configChanged) await setDoc(menuConfigRef, { config: mergedConfig });
    }, []);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info) setCurrentAdmin(info);

        const settingsRef = doc(db, 'app_settings', 'config');
        const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) setMaintenanceMode(docSnap.data().maintenanceMode || false);
            setLoadingMaintenance(false);
        });
        
        Promise.all([loadMenuConfig('petugas'), loadMenuConfig('bendahara')]).then(() => setLoadingMenuConfig(false));

        return () => {
            unsubSettings();
        };
    }, [loadMenuConfig]);


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
  
  const handleMenuConfigChange = async (role: 'petugas' | 'bendahara', id: string, type: 'visible' | 'locked') => {
        const configToUpdate = role === 'petugas' ? petugasMenuConfig : bendaharaMenuConfig;
        const setConfig = role === 'petugas' ? setPetugasMenuConfig : setBendaharaMenuConfig;
        
        const newConfig = configToUpdate.map(item => 
            item.id === id ? { ...item, [type]: !item[type as keyof MenuConfig] } : item
        );
        setConfig(newConfig);

        try {
            if (!currentAdmin) return;
            const menuConfigRef = doc(db, 'app_settings', `${role}_menu`);
            await setDoc(menuConfigRef, { config: newConfig });
            await createLog(currentAdmin, `Mengubah konfigurasi menu untuk peran ${role}`);
            toast({ title: 'Berhasil', description: `Konfigurasi menu ${role} diperbarui.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan konfigurasi menu.' });
        }
    };


  const isAdmin = currentAdmin?.role === 'admin';

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Menu Alat & Pengaturan</CardTitle>
                <CardDescription>Akses cepat ke semua fitur manajemen.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {toolPageItems
                    .filter(item => item.roles.includes(currentAdmin?.role || ''))
                    .map(item => (
                    <Link key={item.id} href={item.href} className="block">
                        <Card className="h-full hover:bg-muted transition-colors text-center flex flex-col items-center justify-center p-4">
                            <item.icon className="h-8 w-8 text-primary mb-2" />
                            <p className="text-sm font-semibold">{item.label}</p>
                        </Card>
                    </Link>
                ))}
            </CardContent>
        </Card>

        {isAdmin && (
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
        )}
    </div>
  );
}
