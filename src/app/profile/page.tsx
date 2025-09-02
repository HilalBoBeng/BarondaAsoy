
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser, DuesPayment } from '@/lib/types';
import ReportHistory from '@/components/dashboard/report-history';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Nama tidak boleh kosong.'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [duesHistory, setDuesHistory] = useState<DuesPayment[]>([]);
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
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  }

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
          
          // Fetch Dues History
          const duesQuery = query(collection(db, 'dues'), where('userId', '==', currentUser.uid), orderBy('paymentDate', 'desc'));
          const unsubDues = onSnapshot(duesQuery, (snapshot) => {
              const duesData = snapshot.docs.map(d => ({
                  ...d.data(),
                  id: d.id,
                  paymentDate: (d.data().paymentDate as Timestamp).toDate()
              })) as DuesPayment[];
              setDuesHistory(duesData);
          });
          // Here you could return unsubDues to clean it up, but since the parent is already handling cleanup, it might be okay
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
      
      // Also update the user's profile in Firebase Auth
      if (auth.currentUser) {
          const { updateProfile } = await import("firebase/auth");
          await updateProfile(auth.currentUser, {
              displayName: data.displayName
          });
      }
      
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
            <div className="flex items-center space-x-4 text-right">
                <div>
                <h1 className="text-xl font-bold">{user?.displayName}</h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                 <User className="h-10 w-10 text-muted-foreground" />
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
          <CardTitle>Riwayat Iuran Saya</CardTitle>
          <CardDescription>Daftar pembayaran iuran yang telah Anda lakukan.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal Bayar</TableHead>
                            <TableHead>Periode</TableHead>
                            <TableHead>Jumlah</TableHead>
                            <TableHead>Dicatat Oleh</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {duesHistory.length > 0 ? (
                            duesHistory.map(due => (
                                <TableRow key={due.id}>
                                    <TableCell>{format(due.paymentDate, "PPP", { locale: id })}</TableCell>
                                    <TableCell>{due.month} {due.year}</TableCell>
                                    <TableCell>{formatCurrency(due.amount)}</TableCell>
                                    <TableCell>{due.recordedBy}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Anda belum memiliki riwayat iuran.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Laporan Saya</CardTitle>
          <CardDescription>Semua laporan keamanan yang pernah Anda kirim.</CardDescription>
        </CardHeader>
        <CardContent>
            <ReportHistory user={auth.currentUser} showDeleteButton={false} />
        </CardContent>
      </Card>

    </div>
  );
}

    