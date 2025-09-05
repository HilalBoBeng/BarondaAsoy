
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Megaphone, Image as ImageIconLucide } from 'lucide-react';
import type { Announcement, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { createLog } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Image from 'next/image';

const announcementSchema = z.object({
  title: z.string().min(1, "Judul tidak boleh kosong.").max(50, "Judul tidak boleh lebih dari 50 karakter."),
  content: z.string().min(1, "Isi pengumuman tidak boleh kosong.").max(1200, "Isi pengumuman tidak boleh lebih dari 1200 karakter."),
  imageUrl: z.string().optional(),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '', imageUrl: '' },
  });

  const { formState: { isSubmitting, isValid } } = form;

   useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) setCurrentAdmin(info);
    
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
            imageUrl: data.imageUrl,
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
      form.reset(currentAnnouncement ? 
        { title: currentAnnouncement.title, content: currentAnnouncement.content, imageUrl: currentAnnouncement.imageUrl || '' } : 
        { title: '', content: '', imageUrl: '' }
      );
    }
  }, [isDialogOpen, currentAnnouncement, form]);
  
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
            form.setValue('imageUrl', reader.result as string);
        };
    }
  };

  const handleDialogOpen = (announcement: Announcement | null = null) => {
    setCurrentAnnouncement(announcement);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: AnnouncementFormValues) => {
    if (!currentAdmin) return;
    try {
      const dataToSave = {
        ...values,
        date: serverTimestamp(),
      };

      if (currentAnnouncement) {
        const docRef = doc(db, 'announcements', currentAnnouncement.id);
        await updateDoc(docRef, dataToSave);
        await createLog(currentAdmin, `Memperbarui pengumuman: "${values.title}"`);
        toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'announcements'), dataToSave);
        await createLog(currentAdmin, `Membuat pengumuman baru: "${values.title}"`);
        toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat." });
      }
      setIsDialogOpen(false);
      setCurrentAnnouncement(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan." });
      console.error(error);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!currentAdmin) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      await createLog(currentAdmin, `Menghapus pengumuman: "${title}"`);
      toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus pengumuman." });
    }
  };
  
  const handleDeleteAll = async () => {
    if (announcements.length === 0 || !currentAdmin) return;
    const batch = writeBatch(db);
    announcements.forEach(ann => {
      const docRef = doc(db, 'announcements', ann.id);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      await createLog(currentAdmin, `Menghapus semua ${announcements.length} pengumuman.`);
      toast({ title: 'Berhasil', description: 'Semua pengumuman telah dihapus.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus semua pengumuman.' });
    }
  }

  const renderActions = (ann: Announcement) => (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={() => handleDialogOpen(ann)} disabled={isSubmitting}>
        <Edit className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isSubmitting}>
             <Trash className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus pengumuman secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(ann.id, ann.title)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <>
        <div className="flex justify-between items-center mb-4">
             <h1 className="text-xl font-bold">Manajemen Pengumuman</h1>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Button onClick={() => handleDialogOpen()} disabled={isSubmitting} size="sm">
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
                  <AlertDialogContent onPointerDownOutside={(e) => e.preventDefault()}>
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
        </div>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : announcements.length > 0 ? (
            announcements.map((ann) => (
              <Card key={ann.id}>
                <CardHeader className="flex flex-row justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{ann.title}</CardTitle>
                    <CardDescription>{ann.date instanceof Date ? format(ann.date, "PPP", {locale: id}) : 'N/A'}</CardDescription>
                  </div>
                   {renderActions(ann)}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{ann.content}</p>
                   {ann.imageUrl && (
                     <div className="mt-4 relative w-full h-40">
                        <Image src={ann.imageUrl} alt="Gambar pengumuman" layout="fill" objectFit="cover" className="rounded-md" />
                     </div>
                   )}
                </CardContent>
              </Card>
            ))
          ) : (
             <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                <Megaphone className="h-10 w-10 mb-2"/>
                <p>Belum ada pengumuman.</p>
            </div>
          )}
        </div>

        <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{currentAnnouncement ? 'Edit' : 'Buat'} Pengumuman</DrawerTitle>
            </DrawerHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DrawerBody className="space-y-4 px-4">
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
                   <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">Gambar <span className="text-xs text-muted-foreground">(Opsional)</span></FormLabel>
                            <FormControl>
                                <Input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*" 
                                />
                            </FormControl>
                             <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <ImageIconLucide className="mr-2 h-4 w-4" /> Pilih Gambar
                            </Button>
                            {field.value && (
                                <div className="mt-2 relative w-32 h-32">
                                    <Image src={field.value} alt="Preview" layout="fill" objectFit="cover" className="rounded-md" />
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                  />
                </DrawerBody>
                <DrawerFooter>
                    <DrawerClose asChild>
                        <Button type="button" variant="secondary">Batal</Button>
                    </DrawerClose>
                    <Button type="submit" disabled={isSubmitting || !isValid}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DrawerFooter>
              </form>
            </Form>
          </DrawerContent>
        </Drawer>
    </>
  );
}
