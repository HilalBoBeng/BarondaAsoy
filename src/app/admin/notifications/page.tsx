
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const notificationSchema = z.object({
  userId: z.string().min(1, "Tujuan (warga atau 'Semua Warga') harus dipilih."),
  title: z.string().min(1, "Judul tidak boleh kosong."),
  message: z.string().min(1, "Pesan tidak boleh kosong."),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

export default function NotificationsAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      userId: '',
      title: '',
      message: '',
    },
  });
  
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            const usersQuery = query(collection(db, "users"), orderBy("displayName"));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as AppUser[];
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat', description: 'Tidak dapat mengambil daftar warga.' });
        } finally {
            setLoading(false);
        }
    };
    fetchUsers();
  }, [toast]);

  const onSubmit = async (values: NotificationFormValues) => {
    setIsSubmitting(true);
    try {
      if (values.userId === 'all') {
        // Send to all users
        if (users.length === 0) {
          toast({ variant: 'destructive', title: "Gagal", description: "Tidak ada warga terdaftar untuk dikirimi notifikasi." });
          setIsSubmitting(false);
          return;
        }
        const batch = writeBatch(db);
        users.forEach(user => {
          const newNotifRef = doc(collection(db, 'notifications'));
          batch.set(newNotifRef, {
            userId: user.uid,
            title: values.title,
            message: values.message,
            read: false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
        toast({ title: "Berhasil", description: `Pemberitahuan berhasil dikirim ke ${users.length} warga.` });
      } else {
        // Send to a single user
        await addDoc(collection(db, 'notifications'), {
          userId: values.userId,
          title: values.title,
          message: values.message,
          read: false,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Berhasil", description: "Pemberitahuan berhasil dikirim." });
      }
      form.reset({ userId: '', title: '', message: '' });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat mengirim pemberitahuan." });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Kirim Pemberitahuan</CardTitle>
        <CardDescription>Kirim pesan atau pemberitahuan ke warga tertentu atau ke semua warga.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-24" />
            </div>
        ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kirim Ke</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tujuan..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Semua Warga</SelectItem>
                          {users.map(user => (
                            <SelectItem key={user.uid} value={user.uid}>
                              {user.displayName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul</FormLabel>
                      <FormControl><Input placeholder="Judul pemberitahuan" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Isi Pesan</FormLabel>
                      <FormControl><Textarea placeholder="Tulis pesan Anda di sini..." {...field} rows={4} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Kirim Pemberitahuan
                </Button>
              </form>
            </Form>
        )}
      </CardContent>
    </Card>
  );
}
