
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Copy, Trash, Eye, EyeOff, History, MonitorOff, Lock, Unlock, Settings, PlusCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogHeader, DialogFooter, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
import { approveOrRejectStaff } from '@/ai/flows/approve-reject-staff';
import { Textarea } from '@/components/ui/textarea';


const shortLinkSchema = z.object({
  longUrl: z.string().url("URL tidak valid. Harap masukkan URL lengkap (contoh: https://example.com)."),
  customSlug: z.string().regex(/^[a-zA-Z0-9_-]*$/, "Custom slug hanya boleh berisi huruf, angka, -, dan _.").max(50, "Custom slug maksimal 50 karakter.").optional(),
});
type ShortLinkFormValues = z.infer<typeof shortLinkSchema>;

interface ShortLinkData {
  id: string;
  slug: string;
  longUrl: string;
  createdAt: Date;
}

interface MenuConfig {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

const addAdminSchema = z.object({
    name: z.string().min(1, "Nama tidak boleh kosong."),
    email: z.string().email("Format email tidak valid."),
    confirmEmail: z.string().email("Format email tidak valid."),
    phone: z.string().min(1, "Nomor HP tidak boleh kosong."),
    addressDetail: z.string().min(1, "Alamat tidak boleh kosong."),
}).refine(data => data.email === data.confirmEmail, {
    message: "Konfirmasi email tidak cocok.",
    path: ["confirmEmail"],
});
type AddAdminFormValues = z.infer<typeof addAdminSchema>;


const initialMenuState: Omit<MenuConfig, 'visible' | 'locked'>[] = [
    { id: 'dashboard', label: 'Dasbor' },
    { id: 'profile', label: 'Profil Saya' },
    { id: 'reports', label: 'Laporan Warga' },
    { id: 'schedule', label: 'Jadwal Saya' },
    { id: 'patrol-log', label: 'Patroli & Log' },
    { id: 'dues', label: 'Iuran Warga' },
    { id: 'honor', label: 'Honor Saya' },
    { id: 'announcements', label: 'Pengumuman' },
    { id: 'notifications', label: 'Notifikasi' },
    { id: 'tools', label: 'Lainnya' },
    { id: 'emergency-contacts', label: 'Kontak Darurat' },
];

export default function ToolsAdminPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ShortLinkData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [revealedUrlId, setRevealedUrlId] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);
  const [loadingMenuConfig, setLoadingMenuConfig] = useState(true);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);


  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: { longUrl: '', customSlug: '' },
  });
  
  const addAdminForm = useForm<AddAdminFormValues>({ resolver: zodResolver(addAdminSchema) });

  useEffect(() => {
    const settingsRef = doc(db, 'app_settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            setMaintenanceMode(docSnap.data().maintenanceMode || false);
        }
        setLoadingMaintenance(false);
    });

    const shortlinksQuery = query(collection(db, 'shortlinks'), orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(shortlinksQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date() } as ShortLinkData;
        });
        setHistory(historyData);
        setLoadingHistory(false);
    });
    
    const menuConfigRef = doc(db, 'app_settings', 'petugas_menu');
    const unsubMenuConfig = onSnapshot(menuConfigRef, (docSnap) => {
        const savedConfig = docSnap.exists() ? docSnap.data().config : [];
        const mergedConfig = initialMenuState.map(initialItem => {
            const savedItem = savedConfig.find((d: MenuConfig) => d.id === initialItem.id);
            if (savedItem) {
                return { ...initialItem, ...savedItem };
            }
            return { ...initialItem, visible: false, locked: false };
        });

        const dashboardItem = mergedConfig.find(item => item.id === 'dashboard');
        if (dashboardItem) {
            dashboardItem.visible = true;
            dashboardItem.locked = false;
        }
        
        setMenuConfig(mergedConfig);
        if (!docSnap.exists()) {
            setDoc(menuConfigRef, { config: mergedConfig });
        }
        setLoadingMenuConfig(false);
    });

    return () => {
        unsubSettings();
        unsubHistory();
        unsubMenuConfig();
    };
  }, []);

  const handleMaintenanceToggle = async (checked: boolean) => {
    setLoadingMaintenance(true);
    try {
        const settingsRef = doc(db, 'app_settings', 'config');
        await setDoc(settingsRef, { maintenanceMode: checked }, { merge: true });
        toast({ title: 'Berhasil', description: `Mode pemeliharaan telah di${checked ? 'aktifkan' : 'nonaktifkan'}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengubah status mode pemeliharaan.' });
        setMaintenanceMode(!checked); 
    } finally {
        setLoadingMaintenance(false);
    }
  }
  
  const handleAddAdmin = async (values: AddAdminFormValues) => {
    setIsSubmitting(true);
    try {
        const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const newAdminData = {
            name: toTitleCase(values.name),
            email: values.email,
            phone: values.phone,
            addressType: 'luar_kilongan',
            addressDetail: values.addressDetail,
            status: 'active',
            accessCode: accessCode,
            createdAt: serverTimestamp(),
            points: 0,
            role: 'admin',
        };
        
        const docRef = doc(collection(db, 'staff'));
        await setDoc(docRef, newAdminData);

        await approveOrRejectStaff({ staffId: docRef.id, approved: true });

        toast({ title: "Admin Berhasil Dibuat", description: `Admin baru ${values.name} telah dibuat dan email berisi kode akses telah dikirim.`});
        setIsAddAdminOpen(false);
        addAdminForm.reset();

    } catch (error) {
        toast({ variant: "destructive", title: "Gagal", description: `Gagal membuat admin baru. ${error instanceof Error ? error.message : ''}`});
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleMenuConfigChange = async (id: string, type: 'visible' | 'locked') => {
      const newConfig = menuConfig.map(item => 
          item.id === id ? { ...item, [type]: !item[type as keyof MenuConfig] } : item
      );
      setMenuConfig(newConfig);
      try {
        const menuConfigRef = doc(db, 'app_settings', 'petugas_menu');
        await setDoc(menuConfigRef, { config: newConfig });
        toast({ title: 'Berhasil', description: 'Konfigurasi menu petugas diperbarui.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan konfigurasi menu.' });
      }
  };


  const onSubmit = async (values: ShortLinkFormValues) => {
    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const shortCode = values.customSlug || nanoid(7);
      
      if (values.customSlug) {
          const q = query(collection(db, 'shortlinks'), where('slug', '==', values.customSlug));
          const existing = await getDocs(q);
          if (!existing.empty) {
              form.setError('customSlug', { type: 'manual', message: 'Custom slug ini sudah digunakan.' });
              setIsSubmitting(false);
              return;
          }
      }

      await addDoc(collection(db, 'shortlinks'), {
        slug: shortCode,
        longUrl: values.longUrl,
        createdAt: serverTimestamp(),
      });

      const fullShortUrl = `${window.location.origin}/go/${shortCode}`;
      setGeneratedLink(fullShortUrl);
      toast({ title: 'Berhasil!', description: 'Tautan pendek berhasil dibuat.' });
      form.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal membuat tautan pendek.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Berhasil', description: 'Tautan berhasil disalin.' });
    });
  };

  const handleDelete = async (id: string) => {
      try {
          await deleteDoc(doc(db, 'shortlinks', id));
          toast({ title: 'Berhasil', description: 'Tautan berhasil dihapus.' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus tautan.' });
      }
  }


  return (
    <>
    <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Pemendek Tautan</CardTitle>
                    <CardDescription>Buat tautan pendek yang mudah dibagikan. Pengguna akan melihat halaman transisi sebelum diarahkan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                            control={form.control}
                            name="longUrl"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>URL Panjang</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="https://example.com/url-sangat-panjang" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="customSlug"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Custom Slug (Opsional)</FormLabel>
                                <FormControl>
                                    <div className="flex items-center">
                                       <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted rounded-l-md border border-r-0 h-10">/go/</span>
                                       <Input {...field} placeholder="promo-juli" className="rounded-l-none"/>
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <div className="flex items-center gap-2">
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                    Buat Tautan
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setIsHistoryOpen(true)}>
                                    <History className="mr-2 h-4 w-4"/> Riwayat
                                </Button>
                            </div>
                        </form>
                    </Form>
                     {generatedLink && (
                        <div className="space-y-2 pt-4 mt-4 border-t">
                            <h3 className="text-sm font-medium">Tautan Baru:</h3>
                            <div className="flex items-center gap-2">
                                <Input value={generatedLink} readOnly className="bg-muted/50" />
                                <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(generatedLink)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Pengaturan Aplikasi</CardTitle>
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
                     <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                            <PlusCircle className="h-5 w-5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <Label htmlFor="maintenance-mode">Manajemen Admin</Label>
                                <p className="text-xs text-muted-foreground">Tambah admin baru untuk membantu mengelola aplikasi.</p>
                            </div>
                        </div>
                        <Button onClick={() => setIsAddAdminOpen(true)}>
                            Tambah Admin
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Manajemen Menu Petugas</CardTitle>
                    <CardDescription>Atur menu yang dapat dilihat atau diakses oleh petugas.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingMenuConfig ? <Skeleton className="h-48 w-full" /> : (
                        <div className="space-y-4">
                            {menuConfig.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <span className="font-medium text-sm">{item.label}</span>
                                     <div className="flex items-center gap-4">
                                      {item.id !== 'dashboard' ? (
                                        <>
                                          <div className="flex items-center space-x-2">
                                              <Switch id={`visible-${item.id}`} checked={item.visible} onCheckedChange={() => handleMenuConfigChange(item.id, 'visible')} />
                                              <Label htmlFor={`visible-${item.id}`} className="text-xs">Tampil</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMenuConfigChange(item.id, 'locked')} disabled={!item.visible}>
                                                  {item.locked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                                              </Button>
                                          </div>
                                        </>
                                      ) : (
                                          <div className="flex items-center gap-4">
                                            <div className="flex items-center space-x-2">
                                                <Switch id={`visible-${item.id}`} checked={true} disabled />
                                                <Label htmlFor={`visible-${item.id}`} className="text-xs text-muted-foreground">Tampil</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                                                    <Unlock className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                          </div>
                                      )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Riwayat Tautan Pendek</DialogTitle>
                <DialogDescription>Daftar tautan pendek yang telah Anda buat.</DialogDescription>
            </DialogHeader>
            <DialogBody>
                 <div className="rounded-lg border overflow-auto max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Tautan Pendek</TableHead>
                                <TableHead>Tautan Asli</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                Array.from({length: 3}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : history.length > 0 ? (
                                history.map((link) => {
                                    const fullShortUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/go/${link.slug}`;
                                    return (
                                    <TableRow key={link.id}>
                                        <TableCell>{format(link.createdAt, 'd MMM yyyy', { locale: id })}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <a href={fullShortUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 break-all">
                                                    {fullShortUrl}
                                                </a>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyToClipboard(fullShortUrl)}>
                                                    <Copy className="h-4 w-4"/>
                                                 </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs">
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono text-xs break-all">
                                                    {revealedUrlId === link.id ? link.longUrl : '*****'}
                                                </p>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setRevealedUrlId(revealedUrlId === link.id ? null : link.id)}>
                                                    {revealedUrlId === link.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                                 {revealedUrlId === link.id && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyToClipboard(link.longUrl)}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon"><Trash className="h-4 w-4"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <DialogTitle>Hapus Tautan Ini?</DialogTitle>
                                                        <DialogDescription>Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(link.id)}>Hapus</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )})
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">Belum ada tautan yang dibuat.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogBody>
        </DialogContent>
    </Dialog>

     <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Admin Baru</DialogTitle>
                <DialogDescription>
                    Isi detail di bawah ini untuk membuat akun admin baru. Kode akses akan dikirim ke email yang didaftarkan.
                </DialogDescription>
            </DialogHeader>
            <Form {...addAdminForm}>
                <form onSubmit={addAdminForm.handleSubmit(handleAddAdmin)}>
                     <DialogBody className="space-y-4">
                        <FormField control={addAdminForm.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={addAdminForm.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={addAdminForm.control} name="confirmEmail" render={({ field }) => (
                            <FormItem><FormLabel>Konfirmasi Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={addAdminForm.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel>Nomor HP</FormLabel><FormControl><Input {...field} inputMode="numeric" /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={addAdminForm.control} name="addressDetail" render={({ field }) => (
                            <FormItem><FormLabel>Alamat</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </DialogBody>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsAddAdminOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Buat Admin
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
