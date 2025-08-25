
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser } from '@/lib/types';
import ReportHistory from '@/components/dashboard/report-history';
import Link from 'next/link';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Nama tidak boleh kosong.'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const auth = getAuth(app);
  const router = useRouter();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      phone: '',
      address: '',
    },
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = { uid: currentUser.uid, ...userDocSnap.data() } as AppUser;
          setUser(userData);
          form.reset({
            displayName: userData.displayName || '',
            phone: userData.phone || '',
            address: userData.address || '',
          });
        }
      } else {
        router.push('/auth/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, data);
      setUser(prev => prev ? { ...prev, ...data } : null);
      toast({ title: 'Berhasil', description: 'Profil berhasil disimpan.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan profil.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl space-y-8">
       <div className="flex items-center justify-between">
            <Button asChild variant="outline" size="sm">
                <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
                </Link>
            </Button>
            <div className="flex items-center space-x-4">
                <div>
                <h1 className="text-2xl font-bold text-right">{user?.displayName}</h1>
                <p className="text-muted-foreground text-right">{user?.email}</p>
                </div>
                 <User className="h-12 w-12 text-muted-foreground" />
            </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Data Diri</CardTitle>
          <CardDescription>Perbarui informasi profil Anda.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor HP / WhatsApp</FormLabel>
                    <FormControl><Input placeholder="08..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat (RT/RW)</FormLabel>
                    <FormControl><Input placeholder="Contoh: RT 01 / RW 02" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            <div className='flex justify-between'>
                <span className='text-muted-foreground'>Status</span>
                <span className='font-medium text-green-600'>Aktif</span>
            </div>
            <div className='flex justify-between'>
                <span className='text-muted-foreground'>Role</span>
                <span className='font-medium'>Warga</span>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Laporan Saya</CardTitle>
          <CardDescription>Semua laporan keamanan yang pernah Anda kirim.</CardDescription>
        </CardHeader>
        <CardContent>
            <ReportHistory user={auth.currentUser} />
        </CardContent>
      </Card>

    </div>
  );
}
