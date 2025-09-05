
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MonitorOff, Settings, Users as UsersIcon, Phone, FileText, Landmark, Banknote, Wallet, History, Bell, Image as ImageIcon, Speaker } from 'lucide-react';
import type { Staff } from '@/lib/types';
import Link from 'next/link';
import { createLog } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';

const popupAnnouncementSchema = z.object({
  title: z.string().min(1, "Judul tidak boleh kosong."),
  content: z.string().min(1, "Konten tidak boleh kosong."),
  imageUrl: z.string().url("URL gambar tidak valid.").optional().or(z.literal('')),
});
type PopupAnnouncementFormValues = z.infer<typeof popupAnnouncementSchema>;


const toolPageItems = [
    { href: "/admin/users", icon: UsersIcon, label: 'Manajemen Pengguna', id: 'users', roles: ['admin'] },
    { href: "/admin/announcements", icon: FileText, label: 'Pengumuman', id: 'announcements', roles: ['admin'] },
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
  const [loadingPopup, setLoadingPopup] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  const [isSubmittingPopup, setIsSubmittingPopup] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PopupAnnouncementFormValues>({
    resolver: zodResolver(popupAnnouncementSchema),
    defaultValues: { title: '', content: '', imageUrl: '' },
  });

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) setCurrentAdmin(info);

    const settingsRef = doc(db, 'app_settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) setMaintenanceMode(docSnap.data().maintenanceMode || false);
        setLoadingMaintenance(false);
    });

    const popupRef = doc(db, 'app_settings', 'popup_announcement');
    const unsubPopup = onSnapshot(popupRef, (docSnap) => {
        if (docSnap.exists()) {
            form.reset(docSnap.data());
        }
        setLoadingPopup(false);
    });

    return () => {
        unsubSettings();
        unsubPopup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 2 MB." });
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            form.setValue('imageUrl', reader.result as string, { shouldValidate: true });
        };
    }
  };

  const onPopupSubmit = async (values: PopupAnnouncementFormValues) => {
    if (!currentAdmin) return;
    setIsSubmittingPopup(true);
    try {
        const popupRef = doc(db, 'app_settings', 'popup_announcement');
        await setDoc(popupRef, {
            ...values,
            updatedAt: serverTimestamp(),
            setBy: currentAdmin.name,
        });
        await createLog(currentAdmin, 'Memperbarui pengumuman popup');
        toast({ title: 'Berhasil', description: 'Pengumuman popup telah diperbarui.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan pengumuman popup.' });
    } finally {
        setIsSubmittingPopup(false);
    }
  }

  const isAdmin = currentAdmin?.role === 'admin';

  return (
    <div className="space-y-6">
       <h1 className="text-xl font-bold">Alat & Pengaturan</h1>
        <Card>
            <CardHeader>
                <CardTitle>Menu Alat</CardTitle>
                <CardDescription>Akses cepat ke semua fitur manajemen.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {toolPageItems
                    .filter(item => item.roles.includes(currentAdmin?.role || ''))
                    .map(item => (
                    <Link key={item.href} href={item.href} className="block">
                        <Card className="h-full hover:bg-muted transition-colors text-center flex flex-col items-center justify-center p-4">
                            <item.icon className="h-8 w-8 text-primary mb-2" />
                            <p className="text-sm font-semibold">{item.label}</p>
                        </Card>
                    </Link>
                ))}
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

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Speaker className="h-5 w-5" /> Atur Pengumuman Popup</CardTitle>
                        <CardDescription>Buat pengumuman yang akan muncul saat pengguna membuka aplikasi.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingPopup ? <Skeleton className="h-40 w-full" /> : (
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onPopupSubmit)} className="space-y-4">
                             <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem><FormLabel>Judul</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="content" render={({ field }) => (
                                <FormItem><FormLabel>Konten Teks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gambar Pengumuman</FormLabel>
                                    <FormControl>
                                        <Input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                                    </FormControl>
                                     <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><ImageIcon className="mr-2 h-4 w-4" /> Pilih Gambar</Button>
                                    {field.value && (
                                        <div className="mt-2 relative w-full aspect-video">
                                            <Image src={field.value} alt="Preview" layout="fill" objectFit="cover" className="rounded-md" />
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <Button type="submit" disabled={isSubmittingPopup}>
                                {isSubmittingPopup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan Pengumuman Popup
                             </Button>
                          </form>
                        </Form>
                      )}
                    </CardContent>
                 </Card>
            </>
        )}
    </div>
  );
}
