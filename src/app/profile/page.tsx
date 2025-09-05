
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
import { Loader2, User, ArrowLeft, Info, Lock, Calendar, CheckCircle, Pencil, Mail, Phone, MapPin, ShieldBan, Camera, LogOut, Trash, X, Key, AlignLeft } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';


const profileSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
  bio: z.string().max(150, "Bio tidak boleh lebih dari 150 karakter.").optional(),
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

  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');

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
    if (!user) return false;
    if (field === 'photoURL' || field === 'bio') return true;
    
    let lastUpdateTimestamp: Timestamp | undefined | null = null;
    if (field === 'phone') {
        lastUpdateTimestamp = user.lastUpdated_phone;
    } else if (field === 'addressDetail') {
        lastUpdateTimestamp = user.lastUpdated_addressDetail;
    }

    if (!lastUpdateTimestamp) return true;
    const lastUpdateDate = lastUpdateTimestamp.toDate();
    return isBefore(lastUpdateDate, subDays(new Date(), 7));
  }, [user]);


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
                    bio: '',
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
            
            if (userData.isBlocked || userData.isSuspended) {
                alert(`Akun Anda sedang dalam status ditangguhkan atau diblokir.`);
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
                bio: userData.bio || '',
            });

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
    if (field === 'displayName') return;
    if (!canEditField(field)) {
        toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi setelah 7 hari dari pembaruan terakhir.` });
        return;
    }
    setEditingField(field);
    form.reset({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      addressDetail: user?.addressDetail || '',
      photoURL: user?.photoURL || '',
      bio: user?.bio || '',
    });
    if (field === 'photoURL') {
        fileInputRef.current?.click();
    } else {
        setIsEditDialogOpen(true);
    }
  };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 800 * 1024) { // 800KB limit
                toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 800 KB." });
                return;
            }
            try {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    form.setValue('photoURL', dataUrl);
                    setEditingField('photoURL');
                    setIsEditDialogOpen(true);
                }
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
          if (editingField !== 'bio' && editingField !== 'photoURL') {
            updateData[`lastUpdated_${editingField}`] = serverTimestamp();
          }
          
          await updateDoc(userDocRef, updateData);
          
          toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
          
          const updatedUser = { ...user, [editingField]: valueToUpdate } as AppUser;
          if (editingField !== 'bio' && editingField !== 'photoURL') {
             updatedUser[`lastUpdated_${editingField}`] = Timestamp.now();
          }

          setUser(updatedUser);

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

  const handleImageZoom = (url?: string | null) => {
    if (url) {
        setZoomedImageUrl(url);
        setIsZoomModalOpen(true);
    }
  };


  if (loading || isLoggingOut) {
     return (
        <div className="flex min-h-screen flex-col bg-muted/40">
           <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-10 w-40" />
           </header>
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="container mx-auto max-w-4xl space-y-8">
                     <Card className="overflow-hidden">
                        <CardHeader className="bg-muted p-6">
                             <div className="flex items-center gap-4">
                                <Skeleton className="h-20 w-20 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-7 w-48" />
                                    <Skeleton className="h-4 w-64" />
                                    <Skeleton className="h-5 w-24" />
                                </div>
                             </div>
                        </CardHeader>
                        <CardContent className="p-0">
                             <div className="divide-y">
                                {Array.from({length: 2}).map((_, i) => (
                                     <div key={i} className="flex items-start justify-between gap-4 p-4">
                                         <div className="flex items-center gap-4 flex-1">
                                            <Skeleton className="h-5 w-5 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-3 w-20" />
                                                <Skeleton className="h-5 w-40" />
                                            </div>
                                         </div>
                                         <Skeleton className="h-8 w-8" />
                                     </div>
                                ))}
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
  }
  
  const fieldLabels: Record<FieldName, string> = {
    displayName: "Nama Lengkap",
    phone: "Nomor HP / WhatsApp",
    addressDetail: "Alamat",
    photoURL: "Foto Profil",
    bio: "Bio"
  };

  const fieldIcons: Record<keyof ProfileFormValues | 'email' | 'address', React.ElementType> = {
    displayName: User,
    email: Mail,
    phone: Phone,
    addressDetail: MapPin,
    photoURL: Camera,
    bio: AlignLeft,
  };

  const renderDataRow = (field: FieldName, value: string | undefined | null) => {
    const Icon = fieldIcons[field];
    const canEdit = canEditField(field);
    let lastUpdateDate: Date | null = null;
    if (field === 'phone' && user?.lastUpdated_phone) lastUpdateDate = user.lastUpdated_phone.toDate();
    if (field === 'addressDetail' && user?.lastUpdated_addressDetail) lastUpdateDate = user.lastUpdated_addressDetail.toDate();
    const isNameField = field === 'displayName';

    return (
        <div className="flex items-start justify-between gap-4 p-4 border-b last:border-b-0">
            <div className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                    <p className="font-medium">{value || 'Belum diisi'}</p>
                     {!canEdit && lastUpdateDate && !isNameField && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                            Bisa diedit lagi {formatDistanceToNow(addDays(lastUpdateDate, 7), { addSuffix: true, locale: id })}
                        </p>
                    )}
                </div>
            </div>
            {!isNameField && (
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(field)} disabled={!canEdit}>
                  {canEdit ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            )}
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
                                <button onClick={() => handleImageZoom(user?.photoURL)}>
                                    <Avatar className="h-20 w-20 border-4 border-background/50">
                                        <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                                        <AvatarFallback className="text-3xl bg-background text-primary">
                                            {user?.displayName?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                                <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full" onClick={() => handleEditClick("photoURL")}>
                                   <Camera className="h-4 w-4"/>
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
                            {renderDataRow("bio", user?.bio)}
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
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        {editingField && editingField === 'bio' && (
                           <FormField
                                control={form.control}
                                name="bio"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{fieldLabels.bio}</FormLabel>
                                    <FormControl><Textarea {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                        {editingField && editingField !== 'photoURL' && editingField !== 'bio' && (
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
                                            <Avatar className="h-40 w-40 mt-2">
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
                                <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan
                                </Button>
                           </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
            <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-lg">
                <DialogTitle className="sr-only">Zoomed Profile Photo</DialogTitle>
                <img src={zoomedImageUrl} alt="Zoomed profile" className="w-full h-auto rounded-lg" />
            </DialogContent>
        </Dialog>

    </div>
  );
}

    