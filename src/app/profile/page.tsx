
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, Timestamp, orderBy, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, ArrowLeft, Info, Lock, Calendar, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser, DuesPayment } from '@/lib/types';
import ReportHistory from '@/components/dashboard/report-history';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, isBefore, addDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';

const profileSchema = z.object({
  displayName: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [duesHistory, setDuesHistory] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
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
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
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

          // Profile locking logic
          if (userData.profileLastUpdated) {
            const lastUpdatedDate = (userData.profileLastUpdated as unknown as Timestamp).toDate();
            const unlockDate = addDays(lastUpdatedDate, 7);
            if (isBefore(new Date(), unlockDate)) {
              setIsProfileLocked(true);
            }
          }
          
          const duesQuery = query(collection(db, 'dues'), where('userId', '==', currentUser.uid));
          const unsubDues = onSnapshot(duesQuery, (snapshot) => {
              const duesData = snapshot.docs.map(d => ({
                  ...d.data(),
                  id: d.id,
                  paymentDate: (d.data().paymentDate as Timestamp).toDate()
              })) as DuesPayment[];
              duesData.sort((a, b) => (b.paymentDate as Date).getTime() - (a.paymentDate as Date).getTime());
              setDuesHistory(duesData);
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
    if (!user || isProfileLocked) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const dataToUpdate = {
        phone: data.phone,
        address: data.address,
        profileLastUpdated: serverTimestamp(),
      };
      await updateDoc(userDocRef, dataToUpdate);
      
      setUser(prev => prev ? { ...prev, ...dataToUpdate, profileLastUpdated: new Date() } : null);
      setIsProfileLocked(true);

      toast({ title: 'Berhasil', description: 'Profil berhasil disimpan dan akan dikunci selama 7 hari.' });
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
     <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <Button asChild variant="outline" size="sm">
                <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
                </Link>
            </Button>
             <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                  <span className="text-lg font-bold text-primary leading-tight">Baronda</span>
                  <p className="text-xs text-muted-foreground leading-tight">Kelurahan Kilongan</p>
              </div>
              <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Logo" 
                width={40} 
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
          </div>
       </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto max-w-4xl space-y-8">
                {isProfileLocked && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                        <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertTitle className="text-blue-800 dark:text-blue-300">Data Diri Dikunci</AlertTitle>
                        <AlertDescription className="text-blue-700 dark:text-blue-400">
                        Untuk keamanan, data Anda tidak dapat diubah selama 7 hari setelah pembaruan terakhir. Fitur ini akan terbuka kembali secara otomatis.
                        </AlertDescription>
                    </Alert>
                )}
                 
                 <Card>
                    <CardHeader>
                        <CardTitle>Biodata Pengguna</CardTitle>
                        <CardDescription>Informasi dasar akun Anda.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-3 rounded-md border">
                            <span className="text-sm font-medium text-muted-foreground">Bergabung Sejak</span>
                             <span className="text-sm font-semibold">{user?.createdAt && user.createdAt instanceof Timestamp ? format(user.createdAt.toDate(), "d MMMM yyyy", { locale: id }) : 'N/A'}</span>
                        </div>
                         <div className="flex justify-between items-center p-3 rounded-md border">
                            <span className="text-sm font-medium text-muted-foreground">Status Akun</span>
                            <Badge variant={user?.isBlocked ? "destructive" : "secondary"} className={!user?.isBlocked ? "bg-green-100 text-green-800" : ""}>
                                 <CheckCircle className="mr-1 h-3 w-3" />
                                 {user?.isBlocked ? 'Diblokir' : 'Aktif'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

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
                                <FormControl><Input {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
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
                                <FormControl><Input placeholder="08..." {...field} readOnly={isProfileLocked} className={isProfileLocked ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl>
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
                                <FormControl><Input placeholder="Contoh: RT 01 / RW 02" {...field} readOnly={isProfileLocked} className={isProfileLocked ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </CardContent>
                        {!isProfileLocked && (
                             <CardFooter className="border-t px-6 py-4">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Perubahan
                                </Button>
                            </CardFooter>
                        )}
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {duesHistory.length > 0 ? (
                                        duesHistory.map(due => (
                                            <TableRow key={due.id}>
                                                <TableCell>{due.paymentDate instanceof Date ? format(due.paymentDate, "PPP", { locale: id }) : 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{due.month} {due.year}</Badge>
                                                </TableCell>
                                                <TableCell>{formatCurrency(due.amount)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
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
                        <ReportHistory user={auth.currentUser} showDeleteButton={true} />
                    </CardContent>
                </Card>
            </div>
        </main>
    </div>
  );
}
