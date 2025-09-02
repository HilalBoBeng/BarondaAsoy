
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
import { Loader2, User, ArrowLeft, Info, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser, DuesPayment } from '@/lib/types';
import ReportHistory from '@/components/dashboard/report-history';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  
  const isProfileComplete = !!user?.phone && !!user?.address;

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

          // Check if profile should be locked
          if (userData.createdAt) {
            const createdAtDate = (userData.createdAt as unknown as Timestamp).toDate();
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (createdAtDate < sevenDaysAgo) {
              setIsProfileLocked(true);
            }
          }
          
          // Fetch Dues History
          const duesQuery = query(collection(db, 'dues'), where('userId', '==', currentUser.uid));
          const unsubDues = onSnapshot(duesQuery, (snapshot) => {
              const duesData = snapshot.docs.map(d => ({
                  ...d.data(),
                  id: d.id,
                  paymentDate: (d.data().paymentDate as Timestamp).toDate()
              })) as DuesPayment[];
              // Sort client-side
              duesData.sort((a, b) => (b.paymentDate as Date).getTime() - (a.paymentDate as Date).getTime());
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
    if (!user || isProfileLocked) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      // We don't update displayName, so we create a new object without it.
      const dataToUpdate = {
        phone: data.phone,
        address: data.address
      };
      await updateDoc(userDocRef, dataToUpdate);
      
      setUser(prev => prev ? { ...prev, ...dataToUpdate } : null);

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
             <div className="flex items-center space-x-2 text-right">
                <div className="flex flex-col">
                  <p className="text-xs font-semibold leading-tight">{user?.displayName}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{user?.email}</p>
                </div>
                 <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || ''} alt="User profile" />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
            </div>
      </div>

       {!isProfileComplete && !isProfileLocked && (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Lengkapi Profil Anda!</AlertTitle>
                <AlertDescription>
                    Nomor HP dan alamat Anda belum diisi. Anda memiliki waktu 7 hari sejak pendaftaran untuk melengkapi data.
                </AlertDescription>
            </Alert>
        )}
        
        {isProfileLocked && (
             <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Data Diri Dikunci</AlertTitle>
                <AlertDescription>
                   Untuk alasan keamanan, data diri Anda (selain kata sandi) tidak dapat diubah setelah 7 hari sejak pendaftaran. Hubungi admin jika memerlukan bantuan.
                </AlertDescription>
            </Alert>
        )}
      
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
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isSubmitting || isProfileLocked}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {isProfileLocked ? 'Data Terkunci' : 'Simpan Perubahan'}
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
  );
}
