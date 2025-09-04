
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
import { Loader2, Link as LinkIcon, Copy, Trash, Eye, EyeOff, History, MonitorOff, Lock, Unlock, Settings, PlusCircle, User, Mail, Phone, MapPin, MoreVertical, Calendar, KeyRound } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import type { Staff } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createAdmin } from '@/ai/flows/create-admin';
import { sendOtp } from '@/ai/flows/send-otp';
import { verifyOtp } from '@/ai/flows/verify-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

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
    addressType: z.enum(['kilongan', 'luar_kilongan'], { required_error: "Pilih jenis alamat." }),
    addressDetail: z.string().optional(),
}).refine(data => data.email === data.confirmEmail, {
    message: "Konfirmasi email tidak cocok.",
    path: ["confirmEmail"],
}).refine((data) => {
    if (data.addressType === 'luar_kilongan') {
      return !!data.addressDetail && data.addressDetail.length > 0;
    }
    return true;
}, {
    message: "Detail alamat harus diisi jika memilih 'Luar Kilongan'.",
    path: ["addressDetail"],
});
type AddAdminFormValues = z.infer<typeof addAdminSchema>;

const otpSchema = z.object({
    otp: z.string().length(6, "Kode OTP harus 6 digit."),
});
type OtpFormValues = z.infer<typeof otpSchema>;


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
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  const [allAdmins, setAllAdmins] = useState<Staff[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<Staff | null>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [newAdminData, setNewAdminData] = useState<AddAdminFormValues | null>(null);
  

  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: { longUrl: '', customSlug: '' },
  });
  
  const addAdminForm = useForm<AddAdminFormValues>({ 
    resolver: zodResolver(addAdminSchema),
    defaultValues: { name: '', email: '', confirmEmail: '', phone: '', addressType: 'kilongan', addressDetail: '' }
  });
  const otpForm = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema), defaultValues: { otp: '' } });
  const addressType = addAdminForm.watch('addressType');

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) {
        setCurrentAdmin(info);
    }
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
    const unsubMenuConfig = onSnapshot(menuConfigRef, async (docSnap) => {
        const savedConfig = docSnap.exists() ? docSnap.data().config : [];
        let configChanged = false;

        const mergedConfig = initialMenuState.map(initialItem => {
            const savedItem = savedConfig.find((d: MenuConfig) => d.id === initialItem.id);
            if (savedItem) {
                return { ...initialItem, ...savedItem };
            }
            configChanged = true;
            return { ...initialItem, visible: false, locked: false };
        });

        const dashboardItem = mergedConfig.find(item => item.id === 'dashboard');
        if (dashboardItem) {
            if (!dashboardItem.visible || dashboardItem.locked) {
                dashboardItem.visible = true;
                dashboardItem.locked = false;
                configChanged = true;
            }
        }
        
        setMenuConfig(mergedConfig);
        if (configChanged) {
            await setDoc(menuConfigRef, { config: mergedConfig });
        }
        setLoadingMenuConfig(false);
    });
    
    const adminsQuery = query(collection(db, 'staff'), where('role', '==', 'admin'));
    const unsubAdmins = onSnapshot(adminsQuery, (snapshot) => {
        const adminsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        setAllAdmins(adminsData);
        setLoadingAdmins(false);
    });

    return () => {
        unsubSettings();
        unsubHistory();
        unsubMenuConfig();
        unsubAdmins();
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
        const emailQuery = query(collection(db, 'staff'), where('email', '==', values.email));
        const phoneQuery = query(collection(db, 'staff'), where('phone', '==', values.phone));
        const userEmailQuery = query(collection(db, 'users'), where('email', '==', values.email));
        const userPhoneQuery = query(collection(db, 'users'), where('phone', '==', values.phone));

        const [emailSnapshot, phoneSnapshot, userEmailSnapshot, userPhoneSnapshot] = await Promise.all([
            getDocs(emailQuery), getDocs(phoneQuery), getDocs(userEmailQuery), getDocs(userPhoneQuery)
        ]);

        if (!emailSnapshot.empty || !userEmailSnapshot.empty) {
            addAdminForm.setError('email', { message: 'Email ini sudah terdaftar.' }); return;
        }
        if (!phoneSnapshot.empty || !userPhoneSnapshot.empty) {
            addAdminForm.setError('phone', { message: 'Nomor HP ini sudah terdaftar.' }); return;
        }
        
        const otpResult = await sendOtp({ email: values.email, context: 'adminCreation' });
        if (!otpResult.success) throw new Error(otpResult.message);
        
        toast({ title: 'OTP Terkirim', description: `Kode OTP telah dikirim ke email calon admin: ${values.email}.` });
        setNewAdminData(values);
        setOtpStep(true);
        otpForm.reset();

    } catch (error) {
        toast({ variant: "destructive", title: "Gagal", description: `Proses pengiriman OTP gagal. ${error instanceof Error ? error.message : ''}`});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (values: OtpFormValues) => {
      if (!newAdminData) return;
      setIsSubmitting(true);
      try {
          const verifyResult = await verifyOtp({ email: newAdminData.email, otp: values.otp, flow: 'adminCreation' });
          if (!verifyResult.success) throw new Error(verifyResult.message);
          
          const createResult = await createAdmin({
            name: toTitleCase(newAdminData.name),
            email: newAdminData.email,
            phone: newAdminData.phone,
            addressType: newAdminData.addressType,
            addressDetail: newAdminData.addressDetail
          });

          if (!createResult.success) throw new Error(createResult.message);
          
          toast({ title: 'Admin Berhasil Dibuat', description: createResult.message });
          setIsAddAdminOpen(false);
          setOtpStep(false);
          addAdminForm.reset();
          otpForm.reset();

      } catch (error) {
          toast({ variant: "destructive", title: "Gagal", description: `Proses pembuatan admin gagal. ${error instanceof Error ? error.message : ''}`});
          otpForm.reset();
      } finally {
          setIsSubmitting(false);
      }
  }

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

  const handleDeleteAdmin = async (adminId: string) => {
      if (!isSuperAdmin) return;
      try {
          await deleteDoc(doc(db, 'staff', adminId));
          toast({ title: 'Berhasil', description: 'Admin telah dihapus.' });
          setIsUserDetailOpen(false);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus admin.' });
      }
  }

  const isSuperAdmin = currentAdmin?.email === 'admin@baronda.or.id';

  const showUserDetail = (user: Staff) => {
      setSelectedUserForDetail(user);
      setIsUserDetailOpen(true);
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
                                       <span className="inline-flex items-center h-10 px-3 text-sm text-muted-foreground bg-muted border border-r-0 rounded-l-md">/go/</span>
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
             {isSuperAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Manajemen Admin</CardTitle>
                        <CardDescription>Tambah admin baru atau lihat daftar admin yang sudah ada.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg flex flex-col items-center text-center">
                            <h3 className="font-semibold mb-2">Tambah Admin Baru</h3>
                             <p className="text-xs text-muted-foreground mb-4">Buat akun untuk administrator baru.</p>
                             <Button onClick={() => setIsAddAdminOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tambah Admin
                            </Button>
                        </div>
                         <div className="p-4 border rounded-lg flex flex-col items-center text-center">
                           <h3 className="font-semibold mb-2">Daftar Admin</h3>
                           <p className="text-xs text-muted-foreground mb-4">Lihat daftar semua administrator.</p>
                           <div className="rounded-lg border overflow-x-auto w-full">
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead>Nama</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {loadingAdmins ? (
                                        <TableRow><TableCell colSpan={2}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                                    ) : allAdmins.length > 0 ? (
                                        allAdmins.map((admin) => (
                                        <TableRow key={admin.id}>
                                            <TableCell className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={admin.photoURL || undefined}/>
                                                    <AvatarFallback>{admin.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                {admin.name}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => showUserDetail(admin)}>
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                    {isSuperAdmin && currentAdmin?.id !== admin.id && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Hapus Admin Ini?</AlertDialogTitle>
                                                                    <AlertDialogDescription>Tindakan ini akan menghapus akun admin secara permanen. Anda yakin?</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteAdmin(admin.id)}>Ya, Hapus</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center h-16">Belum ada admin.</TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    </div>
    
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Riwayat Tautan Pendek</DialogTitle>
                <DialogDescription>Daftar tautan pendek yang telah Anda buat.</DialogDescription>
            </DialogHeader>
            <DialogBody>
                 <div className="rounded-lg border overflow-x-auto">
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
                                        <TableCell className="whitespace-nowrap">{format(link.createdAt, 'd MMM yyyy', { locale: id })}</TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <a href={fullShortUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    {fullShortUrl}
                                                </a>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyToClipboard(fullShortUrl)}>
                                                    <Copy className="h-4 w-4"/>
                                                 </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs break-normal whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono text-xs truncate">
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
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} onPointerDownOutside={(e) => {
            if (otpStep) {
                e.preventDefault();
            }
        }}>
            <DialogHeader>
                <DialogTitle>{otpStep ? 'Verifikasi OTP' : 'Tambah Admin Baru'}</DialogTitle>
                <DialogDescription>
                   {otpStep ? `Masukkan kode 6 digit yang dikirim ke ${newAdminData?.email}.` : 'Isi detail di bawah ini. Kode verifikasi akan dikirim ke email calon admin.'}
                </DialogDescription>
            </DialogHeader>
            {!otpStep ? (
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
                            <FormField
                                control={addAdminForm.control}
                                name="addressType"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alamat</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Pilih jenis alamat" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="kilongan">Kilongan</SelectItem>
                                            <SelectItem value="luar_kilongan">Luar Kilongan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            {addressType === 'luar_kilongan' && (
                                <FormField
                                    control={addAdminForm.control}
                                    name="addressDetail"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Detail Alamat</FormLabel>
                                        <FormControl>
                                        <Textarea placeholder="Masukkan nama jalan, nomor rumah, RT/RW, dll." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsAddAdminOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                                Kirim OTP
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            ) : (
                 <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)}>
                        <DialogBody className="flex flex-col items-center justify-center">
                            <FormField
                                control={otpForm.control}
                                name="otp"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="sr-only">Kode OTP</FormLabel>
                                    <FormControl>
                                        <InputOTP maxLength={6} {...field}>
                                            <InputOTPGroup>
                                                <InputOTPSlot index={0} />
                                                <InputOTPSlot index={1} />
                                                <InputOTPSlot index={2} />
                                                <InputOTPSlot index={3} />
                                                <InputOTPSlot index={4} />
                                                <InputOTPSlot index={5} />
                                            </InputOTPGroup>
                                        </InputOTP>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </DialogBody>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOtpStep(false)}>Kembali</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verifikasi & Buat Akun
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            )}
        </DialogContent>
    </Dialog>

     <Dialog open={isUserDetailOpen} onOpenChange={setIsUserDetailOpen}>
      <DialogContent className="p-0 border-0 max-w-sm">
       <DialogTitle className="sr-only">Detail Admin</DialogTitle>
          {selectedUserForDetail && (
              <Card className="border-0 shadow-none">
                  <CardContent className="p-6 text-center">
                      <Avatar className="h-24 w-24 border-4 border-muted mx-auto">
                          <AvatarImage src={selectedUserForDetail.photoURL || undefined} />
                          <AvatarFallback className="text-4xl">
                              {(selectedUserForDetail.name.charAt(0))?.toUpperCase()}
                          </AvatarFallback>
                      </Avatar>
                      <h2 className="text-xl font-bold mt-2">
                          {selectedUserForDetail.name}
                      </h2>
                      <Badge variant="secondary" className="mt-1">Administrator</Badge>
                      <div className="space-y-3 text-sm text-left border-t mt-4 pt-4">
                          <div className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/><span>{selectedUserForDetail.email}</span></div>
                          <div className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>{selectedUserForDetail.phone || 'Tidak ada no. HP'}</span></div>
                          <div className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>{selectedUserForDetail.addressType === 'kilongan' ? 'Kilongan' : selectedUserForDetail.addressDetail}</span></div>
                           {selectedUserForDetail.createdAt && 'toDate' in selectedUserForDetail.createdAt && (
                             <div className="flex items-start gap-3"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>Bergabung sejak {format((selectedUserForDetail.createdAt as Timestamp).toDate(), "d MMMM yyyy", { locale: id })}</span></div>
                          )}
                      </div>
                  </CardContent>
                   <DialogFooter className="p-4 border-t bg-muted/50 flex justify-between">
                        <Button type="button" variant="secondary" onClick={() => setIsUserDetailOpen(false)}>Tutup</Button>
                  </DialogFooter>
              </Card>
          )}
      </DialogContent>
    </Dialog>
    </>
  );
}

    