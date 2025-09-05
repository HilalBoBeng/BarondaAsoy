
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, PlusCircle, Loader2, Check, X, ShieldCheck, ShieldAlert, MoreVertical, Edit, UserPlus, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Staff } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sendAdminVerificationEmail } from '@/ai/flows/send-admin-verification-email';
import { approveOrRejectStaff } from '@/ai/flows/approve-reject-staff';
import { resetStaffAccessCode } from '@/ai/flows/reset-staff-access-code';
import { createId } from '@paralleldrive/cuid2';

const staffSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong."),
  email: z.string().email("Format email tidak valid."),
  phone: z.string().min(1, "Nomor HP tidak boleh kosong."),
  addressType: z.enum(['kilongan', 'luar_kilongan'], { required_error: "Pilih jenis alamat." }),
  addressDetail: z.string().optional(),
  role: z.enum(['admin', 'bendahara', 'petugas'], { required_error: "Peran harus dipilih." }),
}).refine((data) => data.addressType === 'luar_kilongan' ? !!data.addressDetail && data.addressDetail.length > 0 : true, {
  message: "Detail alamat harus diisi jika memilih 'Luar Kilongan'.",
  path: ["addressDetail"],
});
type StaffFormValues = z.infer<typeof staffSchema>;

const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, 'Alasan penolakan harus diisi.'),
});
type RejectionFormValues = z.infer<typeof rejectionSchema>;

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pendingStaff, setPendingStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRejectionDrawerOpen, setIsRejectionDrawerOpen] = useState(false);
  const [selectedPendingStaff, setSelectedPendingStaff] = useState<Staff | null>(null);
  const { toast } = useToast();

  const staffForm = useForm<StaffFormValues>({ resolver: zodResolver(staffSchema) });
  const rejectionForm = useForm<RejectionFormValues>({ resolver: zodResolver(rejectionSchema) });

  const addressType = staffForm.watch('addressType');

  useEffect(() => {
    setLoading(true);
    const staffQuery = query(collection(db, "staff"), where('status', 'in', ['active', 'suspended']));
    const pendingStaffQuery = query(collection(db, "staff"), where('status', '==', 'pending'));

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
      setStaff(staffData);
    });
    
    const unsubPending = onSnapshot(pendingStaffQuery, (snapshot) => {
      const pendingData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
      setPendingStaff(pendingData);
    });

    Promise.all([onSnapshot(staffQuery, () => {}), onSnapshot(pendingStaffQuery, () => {})]).finally(() => setLoading(false));

    return () => {
        unsubStaff();
        unsubPending();
    };
  }, []);

  const onStaffFormSubmit = async (values: StaffFormValues) => {
    setIsSubmitting(true);
    try {
        const baseUrl = window.location.origin;
        const verificationId = createId(); // Generate a unique ID for the verification document

        const result = await sendAdminVerificationEmail({
            ...values,
            baseUrl,
            verificationId,
        });

        if (result.success) {
            toast({ title: 'Berhasil', description: 'Tautan verifikasi telah dikirim ke email calon staf.' });
            setIsDrawerOpen(false);
            staffForm.reset();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: `Gagal mengirim undangan: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleApprove = async (staffId: string) => {
      setIsSubmitting(true);
      try {
          const result = await approveOrRejectStaff({ staffId, approved: true });
          if(result.success) {
              toast({title: 'Berhasil', description: result.message});
          } else {
              throw new Error(result.message);
          }
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: `Gagal menyetujui: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
          setIsSubmitting(false);
      }
  };

  const onRejectSubmit = async (values: RejectionFormValues) => {
      if (!selectedPendingStaff) return;
      setIsSubmitting(true);
      try {
           const result = await approveOrRejectStaff({ staffId: selectedPendingStaff.id, approved: false, ...values });
           if(result.success) {
              toast({title: 'Berhasil', description: result.message});
              setIsRejectionDrawerOpen(false);
          } else {
              throw new Error(result.message);
          }
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: `Gagal menolak: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const handleResetAccessCode = async (staffId: string) => {
      if (!window.confirm("Anda yakin ingin mereset kode akses untuk staf ini? Kode akses baru akan dibuat dan yang lama tidak akan berlaku lagi.")) return;
      
      setIsSubmitting(true);
      try {
          // Note: The original flow required the current access code, which an admin might not know.
          // For admin-initiated reset, we should bypass this. We need a new flow or to adapt the existing one.
          // For now, let's assume there's a simplified flow or we mock success.
          // This is a placeholder for a real `resetAccessCodeByAdmin` flow.
          const staffMember = staff.find(s => s.id === staffId);
          if (staffMember) {
              // const result = await resetStaffAccessCodeByAdmin({ staffId });
              toast({ title: "Fitur Dalam Pengembangan", description: `Fitur reset kode akses untuk ${staffMember.name} sedang disiapkan.`});
          }
      } catch(error) {
          toast({ variant: 'destructive', title: 'Gagal', description: `Gagal mereset kode akses: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
          setIsSubmitting(false);
      }
  }

  const roleDisplayMap: Record<string, string> = {
      admin: 'Administrator',
      bendahara: 'Bendahara',
      petugas: 'Petugas'
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Manajemen Staf</CardTitle>
                <CardDescription>Kelola akun administrator, bendahara, dan petugas.</CardDescription>
              </div>
              <Button onClick={() => setIsDrawerOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4"/> Tambah Staf
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">Persetujuan ({pendingStaff.length})</TabsTrigger>
              <TabsTrigger value="registered">Terdaftar ({staff.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending" className="mt-4">
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                             pendingStaff.length > 0 ? pendingStaff.map(s => (
                                 <TableRow key={s.id}>
                                     <TableCell className="font-medium">{s.name}</TableCell>
                                     <TableCell>{s.email}</TableCell>
                                     <TableCell className="text-right space-x-2">
                                         <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleApprove(s.id)} disabled={isSubmitting}><Check className="h-4 w-4"/></Button>
                                         <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { setSelectedPendingStaff(s); setIsRejectionDrawerOpen(true); }} disabled={isSubmitting}><X className="h-4 w-4"/></Button>
                                     </TableCell>
                                 </TableRow>
                             )) :
                             <TableRow><TableCell colSpan={3} className="text-center h-24">Tidak ada pendaftaran yang menunggu persetujuan.</TableCell></TableRow>
                            }
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="registered" className="mt-4">
               <div className="rounded-lg border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Peran</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                        <TableBody>
                             {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                              staff.length > 0 ? staff.map(s => (
                                 <TableRow key={s.id}>
                                     <TableCell className="font-medium">{s.name}</TableCell>
                                     <TableCell><Badge variant={s.role === 'admin' ? 'default' : 'secondary'}>{roleDisplayMap[s.role || 'petugas'] || 'Petugas'}</Badge></TableCell>
                                     <TableCell className="text-right">
                                         <Button variant="outline" size="sm" onClick={() => handleResetAccessCode(s.id)} disabled={isSubmitting}><RefreshCcw className="mr-2 h-4 w-4"/> Reset Kode</Button>
                                     </TableCell>
                                 </TableRow>
                             )) :
                              <TableRow><TableCell colSpan={3} className="text-center h-24">Belum ada staf terdaftar.</TableCell></TableRow>
                             }
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent>
              <DrawerHeader>
                  <DrawerTitle>Tambah Staf Baru</DrawerTitle>
                  <DrawerDescription>Undangan verifikasi akan dikirim ke email calon staf. Mereka harus mengklik tautan untuk mengaktifkan akun.</DrawerDescription>
              </DrawerHeader>
              <Form {...staffForm}>
                  <form onSubmit={staffForm.handleSubmit(onStaffFormSubmit)}>
                      <DrawerBody className="space-y-4">
                        <FormField control={staffForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={staffForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={staffForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Nomor HP</FormLabel><FormControl><Input type="tel" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={staffForm.control} name="addressType" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Alamat</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih jenis alamat"/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="kilongan">Warga Kilongan</SelectItem><SelectItem value="luar_kilongan">Warga Luar Kilongan</SelectItem></SelectContent></Select>
                                <FormMessage/>
                            </FormItem>
                        )}/>
                        {addressType === 'luar_kilongan' && <FormField control={staffForm.control} name="addressDetail" render={({ field }) => (<FormItem><FormLabel>Detail Alamat</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>)}/>}
                        <FormField control={staffForm.control} name="role" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Peran</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih peran"/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="admin">Administrator</SelectItem><SelectItem value="bendahara">Bendahara</SelectItem><SelectItem value="petugas">Petugas</SelectItem></SelectContent></Select>
                                <FormMessage/>
                            </FormItem>
                        )}/>
                      </DrawerBody>
                      <DrawerFooter>
                          <DrawerClose asChild><Button type="button" variant="secondary">Batal</Button></DrawerClose>
                          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Kirim Undangan</Button>
                      </DrawerFooter>
                  </form>
              </Form>
          </DrawerContent>
      </Drawer>
      
      <Drawer open={isRejectionDrawerOpen} onOpenChange={setIsRejectionDrawerOpen}>
          <DrawerContent>
              <DrawerHeader>
                  <DrawerTitle>Tolak Pendaftaran</DrawerTitle>
                  <DrawerDescription>Berikan alasan penolakan untuk {selectedPendingStaff?.name}.</DrawerDescription>
              </DrawerHeader>
               <Form {...rejectionForm}>
                  <form onSubmit={rejectionForm.handleSubmit(onRejectSubmit)}>
                      <DrawerBody>
                          <FormField control={rejectionForm.control} name="rejectionReason" render={({ field }) => (<FormItem><FormLabel>Alasan Penolakan</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>)}/>
                      </DrawerBody>
                      <DrawerFooter>
                          <DrawerClose asChild><Button type="button" variant="secondary">Batal</Button></DrawerClose>
                          <Button type="submit" variant="destructive" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Tolak Pendaftaran</Button>
                      </DrawerFooter>
                  </form>
              </Form>
          </DrawerContent>
      </Drawer>
    </>
  );
}
