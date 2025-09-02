"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, Timestamp, orderBy, serverTimestamp, setDoc, getDocs } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, ArrowLeft, Info, Lock, Calendar, CheckCircle, Pencil, Mail, Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser, DuesPayment } from '@/lib/types';
import ReportHistory from '@/components/profile/report-history';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, isBefore, addDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const profileSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type FieldName = keyof ProfileFormValues;

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [duesHistory, setDuesHistory] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldName | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { toast } = useToast();
  const auth = getAuth(app);
  const router = useRouter();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            let userData;

            if (userDocSnap.exists()) {
                userData = { uid: currentUser.uid, ...userDocSnap.data() } as AppUser;
            } else {
                const newUserPayload = {
                    displayName: currentUser.displayName || 'Warga Baru',
                    email: currentUser.email,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    phone: '',
                    address: ''
                };
                await setDoc(userDocRef, newUserPayload);
                const newUserSnap = await getDoc(userDocRef);
                userData = { uid: currentUser.uid, ...newUserSnap.data() } as AppUser;
            }

            setUser(userData);
            form.reset({
                displayName: userData.displayName || '',
                phone: userData.phone || '',
                address: userData.address || '',
            });

            if (userData.lastUpdated) {
                setLastUpdated((userData.lastUpdated as Timestamp).toDate());
            }

            const duesQuery = query(collection(db, 'dues'), where('userId', '==', currentUser.uid));
            const duesSnapshot = await getDocs(duesQuery);
            const duesData = duesSnapshot.docs.map(d => ({
                ...d.data(),
                id: d.id,
                paymentDate: (d.data().paymentDate as Timestamp).toDate()
            })) as DuesPayment[];
            
            duesData.sort((a, b) => (b.paymentDate as Date).getTime() - (a.paymentDate as Date).getTime());
            setDuesHistory(duesData);
        } catch (error) {
            console.error("Error fetching user profile:", error);
            toast({ variant: "destructive", title: "Gagal memuat profil." });
        } finally {
            setLoading(false);
        }
      } else {
        router.push('/auth/login');
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, router, toast, form]);
  
  const canEdit = !lastUpdated || isBefore(lastUpdated, addDays(new Date(), -7));

  const handleEditClick = (field: FieldName) => {
    if (!canEdit) {
        toast({ variant: 'destructive', title: 'Data Dikunci', description: 'Anda baru bisa mengubah data lagi setelah 7 hari dari pembaruan terakhir.' });
        return;
    }
    setEditingField(field);
    form.setValue(field, user?.[field] || '');
    setIsEditDialogOpen(true);
  };
  
  const onSubmit = async (data: ProfileFormValues) => {
      if (!user || !editingField) return;
      setIsSubmitting(true);
      try {
          const userDocRef = doc(db, 'users', user.uid);
          const valueToUpdate = data[editingField];
          
          const updateData: { [key: string]: any } = {};
          updateData[editingField] = valueToUpdate;
          updateData['lastUpdated'] = serverTimestamp();

          await updateDoc(userDocRef, updateData);
          
          toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
          
          const updatedUser = { ...user, [editingField]: valueToUpdate, lastUpdated: new Date() };
          setUser(updatedUser);
          setLastUpdated(new Date());

          setIsEditDialogOpen(false);
          setEditingField(null);
      } catch (error) {
          console.error("Profile update error:", error);
          toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui profil.' });
      } finally {
          setIsSubmitting(false);
      }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  const fieldLabels: Record<FieldName, string> = {
    displayName: "Nama Lengkap",
    phone: "Nomor HP / WhatsApp",
    address: "Alamat (RT/RW)"
  };

  const fieldIcons: Record<keyof ProfileFormValues | 'email', React.ElementType> = {
    displayName: User,
    email: Mail,
    phone: Phone,
    address: MapPin,
  };

  const renderDataRow = (field: 'phone' | 'address', value: string | undefined | null) => {
    const Icon = fieldIcons[field];
    return (
        <div className="flex items-start justify-between gap-4 p-4 border-b last:border-b-0">
            <div className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                    <p className="font-medium">{value || 'Belum diisi'}</p>
                </div>
            </div>
            {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(field)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
  };
  
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
                  <span className="text-base font-bold text-primary leading-tight">Baronda</span>
                  <p className="text-xs text-muted-foreground leading-tight">Kelurahan Kilongan</p>
              </div>
              <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Logo" 
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
          </div>
       </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto max-w-4xl space-y-8">
               <Card className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-br from-primary/80 to-primary p-6">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="h-20 w-20 border-4 border-background/50">
                                    <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                                    <AvatarFallback className="text-3xl bg-background text-primary">
                                        {user?.displayName?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                     <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{user?.displayName || 'Pengguna'}</CardTitle>
                                     {canEdit && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/20" onClick={() => handleEditClick('displayName')}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                     )}
                                </div>
                                <CardDescription className="text-primary-foreground/80 truncate">{user?.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {renderDataRow("phone", user?.phone)}
                            {renderDataRow("address", user?.address)}
                        </div>
                         {!canEdit && (
                            <div className="p-4">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Profil Dikunci</AlertTitle>
                                    <AlertDescription>
                                    Anda dapat mengubah data diri Anda lagi setelah 7 hari dari pembaruan terakhir.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                    </CardContent>
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
                                    {loading ? (
                                       <TableRow><TableCell colSpan={3} className="h-24 text-center">Memuat riwayat iuran...</TableCell></TableRow>
                                    ) : duesHistory.length > 0 ? (
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
                        <ReportHistory user={auth.currentUser} />
                    </CardContent>
                </Card>
            </div>
        </main>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DialogTitle>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        {editingField && (
                           <FormField
                                control={form.control}
                                name={editingField}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{fieldLabels[editingField]}</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

    </div>
  );
}
