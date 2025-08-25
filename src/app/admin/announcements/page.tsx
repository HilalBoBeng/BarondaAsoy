
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2 } from 'lucide-react';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const announcementSchema = z.object({
  title: z.string().min(1, "Judul tidak boleh kosong."),
  content: z.string().min(1, "Isi pengumuman tidak boleh kosong."),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '' },
  });

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsData: Announcement[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
      })) as Announcement[];
      setAnnouncements(announcementsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
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
        // Update existing announcement
        const docRef = doc(db, 'announcements', currentAnnouncement.id);
        await updateDoc(docRef, { ...values });
        toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui." });
      } else {
        // Add new announcement
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
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus pengumuman." });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manajemen Pengumuman</CardTitle>
          <CardDescription>Buat, edit, atau hapus pengumuman untuk warga.</CardDescription>
        </div>
        <Button onClick={() => handleDialogOpen()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Buat Pengumuman Baru
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Isi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : announcements.length > 0 ? (
                announcements.map((ann) => (
                  <TableRow key={ann.id}>
                    <TableCell>{ann.date instanceof Date ? ann.date.toLocaleDateString('id-ID') : 'N/A'}</TableCell>
                    <TableCell className="font-medium">{ann.title}</TableCell>
                    <TableCell className="max-w-md truncate">{ann.content}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleDialogOpen(ann)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm"><Trash className="h-4 w-4" /></Button>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{currentAnnouncement ? 'Edit' : 'Buat'} Pengumuman</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
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
                      <FormControl><Textarea {...field} rows={5} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
