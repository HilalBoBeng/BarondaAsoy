
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, Timestamp, orderBy, serverTimestamp, setDoc, getDocs } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, ArrowLeft, Info, Lock, Calendar, CheckCircle, Pencil, Mail, Phone, MapPin, ShieldBan, Camera, LogOut, Trash, X, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AppUser, DuesPayment } from '@/lib/types';
import ReportHistory from '@/components/profile/report-history';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, isBefore, addDays, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const profileSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { toast } = useToast();
  const auth = getAuth(app);
  const router = useRouter();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  const canEditField = useCallback((field: FieldName) => {
    const lastUpdateDate = lastUpdated[field];
    if (!lastUpdateDate) return true;
    const cooldownDays = field === 'photoURL' ? 1 : 7;
    return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
  }, [lastUpdated]);


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
                    photoURL: null,
                    lastUpdated_displayName: null,
                    lastUpdated_phone: null,
                    lastUpdated_addressDetail: null,
                    lastUpdated_photoURL: null,
                    phone: '',
                    addressType: 'kilongan',
                    addressDetail: '',
                    isBlocked: false,
                    isSuspended: false,
                    suspensionReason: null,
                    suspensionEndDate: null,
                };
                await setDoc(userDocRef, newUserPayload);
                const newUserSnap = await getDoc(userDocRef);
                userData = { uid: currentUser.uid, ...newUserSnap.data() } as AppUser;
            }
            
            if (userData.isBlocked) {
                const dialog = document.createElement('div');
                document.body.appendChild(dialog);
                alert(`Akun Diblokir. Alasan: Anda tidak dapat mengakses aplikasi.`);
                auth.signOut();
                router.push('/auth/login');
                return;
            }
             if (userData.isSuspended) {
                const endDate = (userData.suspensionEndDate as Timestamp)?.toDate() || null;
                const endDateString = endDate ? formatDistanceToNow(endDate, { addSuffix: true, locale: id }) : 'permanen';
                 
                const dialog = document.createElement('div');
                document.body.appendChild(dialog);
                
                alert(`Akun Ditangguhkan. Alasan: ${userData.suspensionReason || 'Tidak ada alasan'}. Penangguhan berakhir ${endDateString}.`);
                 
                 auth.signOut();
                 router.push('/auth/login');
                 return;
             }


            setUser(userData);
            form.reset({
                displayName: userData.displayName || '',
                phone: userData.phone || '',
                addressDetail: userData.addressDetail || '',
                photoURL: userData.photoURL || '',
            });

            const lastUpdatedDates: { [key in FieldName]?: Date | null } = {};
            if (userData.lastUpdated_displayName) lastUpdatedDates.displayName = (userData.lastUpdated_displayName as Timestamp).toDate();
            if (userData.lastUpdated_phone) lastUpdatedDates.phone = (userData.lastUpdated_phone as Timestamp).toDate();
            if (userData.lastUpdated_addressDetail) lastUpdatedDates.addressDetail = (userData.lastUpdated_addressDetail as Timestamp).toDate();
            if (userData.lastUpdated_photoURL) lastUpdatedDates.photoURL = (userData.lastUpdated_photoURL as Timestamp).toDate();
            setLastUpdated(lastUpdatedDates);


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router, toast]);

  const handleEditClick = (field: FieldName) => {
    if (field === 'displayName') return; // Disable name editing
    if (field !== 'photoURL' && !canEditField(field)) {
        toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi setelah 7 hari dari pembaruan terakhir.` });
        return;
    }
    setEditingField(field);
    form.reset({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      addressDetail: user?.addressDetail || '',
      photoURL: user?.photoURL || '',
    });
    if (field === 'photoURL') {
        fileInputRef.current?.click();
    } else {
        setIsEditDialogOpen(true);
    }
  };

    const compressImage = (file: File, maxSizeKB: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    
                    const size = Math.min(width, height);
                    const x = (width - size) / 2;
                    const y = (height - size) / 2;

                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, x, y, size, size, 0, 0, size, size);

                    let quality = 0.9;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const getKB = (str: string) => new Blob([str]).size / 1024;
                    
                    while (getKB(dataUrl) > maxSizeKB && quality > 0.1) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve(dataUrl);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEditField('photoURL')) {
            toast({ variant: 'destructive', title: 'Foto Profil Dikunci', description: `Anda baru bisa mengubah foto profil lagi setelah 24 jam.` });
            return;
        }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { 
                toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 2 MB." });
                return;
            }
            try {
                const compressedDataUrl = await compressImage(file, 64);
                form.setValue('photoURL', compressedDataUrl);
                setEditingField('photoURL');
                setIsEditDialogOpen(true);
            } catch(err) {
                 toast({ variant: "destructive", title: "Gagal Memproses Gambar", description: "Terjadi kesalahan saat memproses gambar Anda." });
            }
        }
    };

  const onSubmit = async (data: ProfileFormValues) => {
      if (!user || !editingField) return;
      setIsSubmitting(true);
      try {
          const userDocRef = doc(db, 'users', user.uid);
          const valueToUpdate = data[editingField];
          
          const updateData: { [key: string]: any } = {};
          updateData[editingField] = valueToUpdate;
          updateData[`lastUpdated_${editingField}`] = serverTimestamp();
          
          await updateDoc(userDocRef, updateData);
          
          toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
          
          const newLastUpdatedDate = new Date();
          const updatedUser = { ...user, [editingField]: valueToUpdate };
          setUser(updatedUser as AppUser);
          setLastUpdated(prev => ({ ...prev, [editingField!]: newLastUpdatedDate }));

          setIsEditDialogOpen(false);
          setEditingField(null);
      } catch (error) {
          console.error("Profile update error:", error);
          toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui profil.' });
      } finally {
          setIsSubmitting(false);
      }
  }

    const handleDeletePhoto = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { 
                photoURL: null,
            });
            toast({ title: 'Berhasil', description: 'Foto profil telah dihapus.' });
            const updatedUser = { ...user, photoURL: null };
            setUser(updatedUser as AppUser);
            setIsEditDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus foto profil.' });
        } finally {
            setIsSubmitting(false);
        }
    };

  if (loading || isLoggingOut) {
     return (
        <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background transition-opacity duration-500", isLoggingOut ? "animate-fade-out" : "")}>
            <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Loading Logo" 
                width={120} 
                height={120} 
                className="animate-logo-pulse"
                priority
            />
            {isLoggingOut && <p className="mt-4 text-lg text-muted-foreground animate-fade-in">Anda sedang dialihkan...</p>}
        </div>
    );
  }
  
  const fieldLabels: Record<FieldName, string> = {
    displayName: "Nama Lengkap",
    phone: "Nomor HP / WhatsApp",
    addressDetail: "Alamat",
    photoURL: "Foto Profil"
  };

  const fieldIcons: Record<keyof ProfileFormValues | 'email' | 'address', React.ElementType> = {
    displayName: User,
    email: Mail,
    phone: Phone,
    addressDetail: MapPin,
    photoURL: Camera,
  };

  const renderDataRow = (field: FieldName, value: string | undefined | null) => {
    const Icon = fieldIcons[field];
    const canEdit = canEditField(field);
    const cooldownDays = field === 'photoURL' ? 1 : 7;
    const lastUpdateDate = lastUpdated[field];

    return (
        <div className="flex items-start justify-between gap-4 p-4 border-b last:border-b-0">
            <div className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                    <p className="font-medium">{value || 'Belum diisi'}</p>
                     {!canEdit && lastUpdateDate && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                            Bisa diedit lagi {formatDistanceToNow(addDays(lastUpdateDate, cooldownDays), { addSuffix: true, locale: id })}
                        </p>
                    )}
                </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(field)} disabled={!canEdit}>
                {canEdit ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
        </div>
    );
  };
  
  return (
     <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                    <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Kembali
                    </Link>
                </Button>
            </div>
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
                                <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full" onClick={() => handleEditClick("photoURL")}>
                                   {canEditField("photoURL") ? <Camera className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}
                                </Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                     <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{user?.displayName || 'Pengguna'}</CardTitle>
                                </div>
                                <CardDescription className="text-primary-foreground/80 truncate">{user?.email}</CardDescription>
                                <Badge variant="secondary" className="mt-2">Warga</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {renderDataRow("phone", user?.phone)}
                            {renderDataRow("addressDetail", user?.addressType === 'kilongan' ? 'Kilongan' : user?.addressDetail)}
                        </div>
                         
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
        
        <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingField(null); setIsEditDialogOpen(isOpen); }}>
            <DialogContent className="rounded-lg">
                <DialogHeader>
                    <DialogTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DialogTitle>
                     {editingField === 'photoURL' && (
                        <CardDescription>
                            Setelah disimpan, Anda baru bisa mengganti foto lagi setelah 24 jam.
                        </CardDescription>
                     )}
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        {editingField && editingField !== 'photoURL' && (
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
                        {editingField === 'photoURL' && (
                            <FormField
                                control={form.control}
                                name="photoURL"
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="hidden"><Input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} ref={fileInputRef} /></div>
                                    </FormControl>
                                    {field.value && (
                                       <div className="flex flex-col items-center gap-4">
                                            <Avatar className="h-32 w-32 mt-2">
                                                <AvatarImage src={field.value} alt="Preview" />
                                                <AvatarFallback>
                                                    <Loader2 className="animate-spin" />
                                                </AvatarFallback>
                                            </Avatar>
                                       </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                         <DialogFooter className="sm:justify-between gap-2 pt-4">
                           {editingField === 'photoURL' && user?.photoURL ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="destructive">
                                            <Trash className="h-4 w-4 mr-2" /> Hapus Foto
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Foto Profil?</AlertDialogTitle>
                                            <AlertDialogDescription>Tindakan ini akan menghapus foto profil Anda secara permanen. Anda dapat mengunggah yang baru nanti.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeletePhoto}>Ya, Hapus</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                           ) : <div></div>}
                           <div className="flex gap-2 justify-end">
                                <Button type="button" variant="secondary" onClick={() => {setIsEditDialogOpen(false); setEditingField(null)}}>Batal</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan
                                </Button>
                           </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

    </div>
  );
}
