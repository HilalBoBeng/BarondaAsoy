
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Copy, Trash, Eye, EyeOff, History, MonitorOff } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogHeader, DialogFooter, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

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

export default function SettingsAdminPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ShortLinkData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [selectedLongUrl, setSelectedLongUrl] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);

  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: { longUrl: '', customSlug: '' },
  });
  
  useEffect(() => {
    const settingsRef = doc(db, 'app_settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            setMaintenanceMode(docSnap.data().maintenanceMode || false);
        }
        setLoadingMaintenance(false);
    });

    const q = query(collection(db, 'shortlinks'), orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(q, (snapshot) => {
        const historyData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
            } as ShortLinkData;
        });
        setHistory(historyData);
        setLoadingHistory(false);
    });

    return () => {
        unsubSettings();
        unsubHistory();
    };
  }, []);

  const handleMaintenanceToggle = async (checked: boolean) => {
    setMaintenanceMode(checked);
    setLoadingMaintenance(true);
    try {
        const settingsRef = doc(db, 'app_settings', 'config');
        await setDoc(settingsRef, { maintenanceMode: checked }, { merge: true });
        toast({ title: 'Berhasil', description: `Mode pemeliharaan telah di${checked ? 'aktifkan' : 'nonaktifkan'}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengubah status mode pemeliharaan.' });
        setMaintenanceMode(!checked); // Revert on failure
    } finally {
        setLoadingMaintenance(false);
    }
  }

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

  const showOriginalUrl = (url: string) => {
    setSelectedLongUrl(url);
    setIsUrlModalOpen(true);
  };

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
                                       <span className="text-sm text-muted-foreground p-2 bg-muted rounded-l-md border border-r-0">/go/</span>
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

            <Card>
                <CardHeader>
                    <CardTitle>Pengaturan Aplikasi</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                            <MonitorOff className="h-5 w-5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <Label htmlFor="maintenance-mode">Mode Pemeliharaan</Label>
                                <p className="text-xs text-muted-foreground">Alihkan semua traffic ke halaman maintenance.</p>
                            </div>
                        </div>
                        {loadingMaintenance ? <Skeleton className="h-6 w-10" /> : <Switch id="maintenance-mode" checked={maintenanceMode} onCheckedChange={handleMaintenanceToggle} />}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <h2 className="font-bold text-lg mb-4">Informasi Lainnya</h2>
            <p className="text-muted-foreground">Bagian ini sedang dalam pengembangan.</p>
        </div>
    </div>
    
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Riwayat Tautan Pendek</DialogTitle>
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
                                                <a href={fullShortUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    {fullShortUrl}
                                                </a>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(fullShortUrl)}>
                                                    <Copy className="h-4 w-4"/>
                                                 </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs">
                                            <div className="flex items-center gap-2">
                                                <span>*****</span>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => showOriginalUrl(link.longUrl)}>
                                                    <Eye className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon"><Trash className="h-4 w-4"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus Tautan Ini?</AlertDialogTitle>
                                                        <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
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

    <Dialog open={isUrlModalOpen} onOpenChange={setIsUrlModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tautan Asli</DialogTitle>
                <DialogDescription>
                    Ini adalah URL tujuan lengkap untuk tautan pendek yang dipilih.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Input value={selectedLongUrl} readOnly className="bg-muted" />
                 <Button className="w-full" onClick={() => copyToClipboard(selectedLongUrl)}>
                    <Copy className="mr-2 h-4 w-4" /> Salin Tautan Asli
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
