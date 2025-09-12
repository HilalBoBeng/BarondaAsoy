
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from "firebase/auth";
import { db, app } from "@/lib/firebase/client";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import type { AppUser, DuesPayment } from "@/lib/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { KeyRound, User, Phone, MapPin, Lock, Pencil, Camera, LogOut, AlignLeft } from "lucide-react";
import Image from 'next/image';

const profileEditSchema = z.object({
  bio: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
type FieldName = 'bio' | 'phone' | 'addressDetail' | 'photoURL';

export default function ProfilePage() {
    const [userInfo, setUserInfo] = useState<AppUser | null>(null);
    const [duesHistory, setDuesHistory] = useState<DuesPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [isLogoutDrawerOpen, setIsLogoutDrawerOpen] = useState(false);

    const router = useRouter();
    const { toast } = useToast();
    const auth = getAuth(app);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<ProfileEditFormValues>({ 
        resolver: zodResolver(profileEditSchema),
    });
    
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const unsubUser = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserInfo({ uid: docSnap.id, ...docSnap.data() } as AppUser);
                    }
                    setLoading(false);
                });

                const duesQuery = query(collection(db, 'dues'), where('userId', '==', user.uid));
                const unsubDues = onSnapshot(duesQuery, (snapshot) => {
                    const payments = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as DuesPayment);
                    setDuesHistory(payments);
                });
                
                return () => { unsubUser(); unsubDues(); };
            } else {
                router.push('/auth/login');
            }
        });
        return () => unsubscribe();
    }, [auth, router]);

    const sortedDuesHistory = useMemo(() => {
        return [...duesHistory].sort((a, b) => {
            const dateA = a.paymentDate instanceof Timestamp ? a.paymentDate.toMillis() : 0;
            const dateB = b.paymentDate instanceof Timestamp ? b.paymentDate.toMillis() : 0;
            return dateB - dateA;
        });
    }, [duesHistory]);


    const handleEditClick = (field: FieldName) => {
        if (!userInfo) return;
        setEditingField(field);
        form.reset({
            bio: userInfo.bio || '',
            phone: userInfo.phone || '',
            addressDetail: userInfo.addressDetail || '',
            photoURL: userInfo.photoURL || '',
        });
        if (field === 'photoURL') {
            fileInputRef.current?.click();
        } else {
            setIsEditDialogOpen(true);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 800 * 1024) { // 800KB limit
                toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 800 KB." });
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                form.setValue('photoURL', event.target?.result as string);
                setEditingField('photoURL');
                setIsEditDialogOpen(true);
            }
        }
    };

    const onProfileEditSubmit = async (data: ProfileEditFormValues) => {
        if (!userInfo || !editingField) return;
        setIsSubmitting(true);
        try {
            const userRef = doc(db, 'users', userInfo.uid);
            const valueToUpdate = data[editingField];
            
            await updateDoc(userRef, { [editingField]: valueToUpdate });
            
            toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
            setIsEditDialogOpen(false);
            setEditingField(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui profil.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = () => {
        signOut(auth).then(() => {
            localStorage.removeItem('userRole');
            router.push('/auth/login');
        });
    }
    
    if (loading || !userInfo) {
        return (
            <div className="space-y-6">
                <Card className="overflow-hidden"><CardHeader className="bg-muted p-6 flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64" /></div></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    const fieldLabels: Record<FieldName, string> = {
        bio: "Bio",
        phone: "Nomor HP / WhatsApp",
        addressDetail: "Alamat",
        photoURL: "Foto Profil"
    };

    const dataRows = [
        { field: 'bio' as FieldName, value: userInfo.bio, icon: AlignLeft },
        { field: 'phone' as FieldName, value: userInfo.phone, icon: Phone },
        { field: 'addressDetail' as FieldName, value: userInfo.addressDetail || (userInfo.addressType === 'kilongan' ? 'Kilongan' : 'Belum diisi'), icon: MapPin },
    ];
    
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Profil Saya</h1>
            <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-primary/80 to-primary p-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-4 border-background/50">
                                <AvatarImage src={userInfo.photoURL || undefined} alt={userInfo.displayName || ''} />
                                <AvatarFallback className="text-3xl bg-background text-primary">
                                    {userInfo.displayName?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                             <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full" onClick={() => handleEditClick("photoURL")}>
                                <Camera className="h-4 w-4"/>
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{userInfo.displayName}</CardTitle>
                            <CardDescription className="text-primary-foreground/80 truncate">{userInfo.email}</CardDescription>
                            <Badge variant="secondary" className="mt-2">Warga</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {dataRows.map(row => {
                           const Icon = row.icon;
                           return(
                            <div key={row.field} className="flex items-start justify-between gap-4 p-4">
                                <div className="flex items-center gap-4">
                                     <Icon className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">{fieldLabels[row.field as Exclude<FieldName, 'photoURL'>]}</p>
                                        <p className="font-medium">{row.value || 'Belum diisi'}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(row.field as FieldName)}>
                                     <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                           )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Iuran Saya</CardTitle>
                    <CardDescription>Daftar pembayaran iuran yang telah Anda lakukan.</CardDescription>
                </CardHeader>
                <CardContent>
                    {sortedDuesHistory.length > 0 ? (
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                             <thead>
                               <tr className="text-left text-muted-foreground">
                                 <th className="pb-2 font-medium">Tanggal Bayar</th>
                                 <th className="pb-2 font-medium">Periode</th>
                                 <th className="pb-2 font-medium text-right">Jumlah</th>
                               </tr>
                             </thead>
                             <tbody>
                               {sortedDuesHistory.map(due => (
                                 <tr key={due.id} className="border-t">
                                   <td className="py-2">{due.paymentDate instanceof Timestamp ? format(due.paymentDate.toDate(), "d MMMM yyyy", { locale: id }) : 'N/A'}</td>
                                   <td><Badge variant="secondary">{due.month} {due.year}</Badge></td>
                                   <td className="text-right">{formatCurrency(due.amount)}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">Anda belum memiliki riwayat pembayaran iuran.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base text-destructive">Keluar</CardTitle></CardHeader>
                <CardContent>
                     <Button variant="destructive" className="w-full" onClick={() => setIsLogoutDrawerOpen(true)}>
                        <LogOut className="mr-2 h-4 w-4" /> Keluar dari Akun
                    </Button>
                </CardContent>
            </Card>
            
            <Drawer open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DrawerContent>
                    <DrawerHeader><DrawerTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DrawerTitle></DrawerHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onProfileEditSubmit)}>
                             <DrawerBody className="px-4">
                                {editingField && editingField !== 'photoURL' && (
                                <FormField
                                    control={form.control}
                                    name={editingField}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{fieldLabels[editingField]}</FormLabel>
                                        <FormControl>
                                            {editingField === 'bio' ? <Textarea {...field} /> : <Input {...field} />}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                )}
                                 {editingField === 'photoURL' && form.getValues('photoURL') && (
                                    <div className="flex justify-center">
                                        <Image src={form.getValues('photoURL')!} alt="Preview" width={128} height={128} className="rounded-full h-32 w-32 object-cover" />
                                    </div>
                                )}
                            </DrawerBody>
                            <DrawerFooter><DrawerClose asChild><Button type="button" variant="secondary">Batal</Button></DrawerClose><Button type="submit" disabled={isSubmitting}>Simpan</Button></DrawerFooter>
                        </form>
                    </Form>
                </DrawerContent>
            </Drawer>

            <Drawer open={isLogoutDrawerOpen} onOpenChange={setIsLogoutDrawerOpen}>
                <DrawerContent>
                    <DrawerHeader className="text-center"><DrawerTitle>Konfirmasi Keluar</DrawerTitle><DrawerDescription>Anda yakin ingin keluar?</DrawerDescription></DrawerHeader>
                    <DrawerFooter className="flex-col-reverse"><DrawerClose asChild><Button variant="secondary">Batal</Button></DrawerClose><Button variant="destructive" onClick={handleLogout}>Ya, Keluar</Button></DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
