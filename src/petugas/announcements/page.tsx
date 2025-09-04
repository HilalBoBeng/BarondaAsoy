
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const announcementSchema = z.object({
  title: z.string().min(1, "Judul tidak boleh kosong.").max(50, "Judul tidak boleh lebih dari 50 karakter."),
  content: z.string().min(1, "Isi pengumuman tidak boleh kosong.").max(1200, "Isi pengumuman tidak boleh lebih dari 1200 karakter."),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export default function AnnouncementsPetugasPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '' },
  });

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsData: Announcement[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date;
        return {
            id: doc.id,
            title: data.title,
            content: data.content,
            date: date instanceof Timestamp ? date.toDate() : date,
        }
      }) as Announcement[];
      setAnnouncements(announcementsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      setLoading(false);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat memuat pengumuman.' });
    });
    return () => unsubscribe();
  }, [toast]);
  
  useEffect(() => {
    if (isDialogOpen) {
      form.reset(currentAnnouncement ? { title: currentAnnouncement.title, content: currentAnnouncement.content } : { title: '', content: '' });
    }
  }, [isDialogOpen, currentAnnouncement, form]);

  const handleDialogOpen = (announcement: Announcement | null = null) => {
    setCurrentAnnouncement(announcement);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: AnnouncementFormValues) => {
    setIsSubmitting(true);
    try {
      if (currentAnnouncement) {
        const docRef = doc(db, 'announcements', currentAnnouncement.id);
        await updateDoc(docRef, values);
        toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...values,
          date: serverTimestamp(),
        });
        toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat." });
      }
      setIsDialogOpen(false);
      setCurrentAnnouncement(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan." });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus pengumuman." });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (announcements.length === 0) return;
    const batch = writeBatch(db);
    announcements.forEach(ann => {
      const docRef = doc(db, 'announcements', ann.id);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      toast({ title: 'Berhasil', description: 'Semua pengumuman telah dihapus.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus semua pengumuman.' });
    }
  }

  const renderActions = (ann: Announcement) => (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={() => handleDialogOpen(ann)} disabled={isSubmitting || !!isDeleting}>
        <Edit className="h-4 w-4" />
        <span className="sr-only">Edit</span>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isSubmitting || !!isDeleting}>
            {isDeleting === ann.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
            <span className="sr-only">Hapus</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus pengumuman secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(ann.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-grow">
          <CardTitle>Manajemen Pengumuman</CardTitle>
          <CardDescription>Buat, edit, atau hapus pengumuman untuk warga.</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button onClick={() => handleDialogOpen()} disabled={isSubmitting || !!isDeleting}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat
            </Button>
            {announcements.length > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                            <Trash className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Semua Pengumuman?</AlertDialogTitle>
                            <AlertDialogDescription>Tindakan ini akan menghapus semua {announcements.length} pengumuman.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAll}>Ya, Hapus Semua</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Mobile View */}
        <div className="sm:hidden space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : announcements.length > 0 ? (
            announcements.map((ann) => (
              <Card key={ann.id}>
                <CardHeader>
                  <CardTitle className="text-base">{ann.title}</CardTitle>
                  <CardDescription>{ann.date instanceof Date ? ann.date.toLocaleDateString('id-ID') : 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{ann.content}</p>
                </CardContent>
                <CardFooter>
                  {renderActions(ann)}
                </CardFooter>
              </Card>
            ))
          ) : (
             <div className="text-center py-12 text-muted-foreground">Belum ada pengumuman.</div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Isi</TableHead>
                  <TableHead className="text-right w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-[88px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : announcements.length > 0 ? (
                  announcements.map((ann) => (
                    <TableRow key={ann.id}>
                      <TableCell>{ann.date instanceof Date ? ann.date.toLocaleDateString('id-ID') : 'N/A'}</TableCell>
                      <TableCell className="font-medium">{ann.title}</TableCell>
                      <TableCell className="max-w-md truncate">{ann.content}</TableCell>
                      <TableCell className="text-right">
                        {renderActions(ann)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                      Belum ada pengumuman.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentAnnouncement ? 'Edit' : 'Buat'} Pengumuman</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Judul</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            maxLength={50}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Isi Pengumuman</FormLabel>
                        <FormControl><Textarea {...field} rows={5} maxLength={1200} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Batal</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
