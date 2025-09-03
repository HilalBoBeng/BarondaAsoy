
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Copy, Trash, ExternalLink } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const shortLinkSchema = z.object({
  longUrl: z.string().url("URL tidak valid. Harap masukkan URL lengkap (contoh: https://example.com)."),
});
type ShortLinkFormValues = z.infer<typeof shortLinkSchema>;

interface ShortLinkData {
  id: string;
  slug: string;
  longUrl: string;
  createdAt: Date;
}

export default function ShortLinkAdminPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [history, setHistory] = useState<ShortLinkData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: { longUrl: '' },
  });
  
  useEffect(() => {
    const q = query(collection(db, 'shortlinks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp).toDate(),
        })) as ShortLinkData[];
        setHistory(historyData);
        setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, []);

  const onSubmit = async (values: ShortLinkFormValues) => {
    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const shortCode = nanoid(7);
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
    <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
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
                            <Button type="submit" disabled={isSubmitting} className="w-full">
                                {isSubmitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                )}
                                Buat Tautan
                            </Button>
                        </form>
                    </Form>

                    {generatedLink && (
                        <div className="space-y-2 pt-4 mt-4 border-t">
                            <h3 className="text-sm font-medium">Tautan Baru:</h3>
                            <div className="flex items-center gap-2">
                                <Input value={generatedLink} readOnly />
                                <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(generatedLink)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
             <Card>
                <CardHeader>
                    <CardTitle>Riwayat Tautan</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
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
                                    history.map((link) => (
                                        <TableRow key={link.id}>
                                            <TableCell>{format(link.createdAt, 'd MMM yyyy', { locale: id })}</TableCell>
                                            <TableCell>
                                                <a href={`/go/${link.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    /go/{link.slug} <ExternalLink className="h-3 w-3"/>
                                                </a>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                <a href={link.longUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                    {link.longUrl}
                                                </a>
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
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Belum ada tautan yang dibuat.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
