
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Copy, Trash, Eye, EyeOff, History } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogHeader, DialogFooter, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogBody } from '@/components/ui/dialog';

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

export default function PetugasToolsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ShortLinkData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [revealedUrlId, setRevealedUrlId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: { longUrl: '', customSlug: '' },
  });
  
  useEffect(() => {
    const shortlinksQuery = query(collection(db, 'shortlinks'), orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(shortlinksQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date() } as ShortLinkData;
        });
        setHistory(historyData);
        setLoadingHistory(false);
    });
    
    return () => unsubHistory();
  }, []);

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
    <div className="space-y-6">
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
    </>
  );
}
