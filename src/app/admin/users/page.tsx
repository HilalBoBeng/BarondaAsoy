
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs, updateDoc, writeBatch, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon, ShieldX, PlusCircle, Loader2, Check, X, Star, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser, Staff } from '@/lib/types';
import { sendStaffAccessCode } from '@/ai/flows/send-staff-access-code';
import { Badge } from '@/components/ui/badge';


export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pendingStaff, setPendingStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleAccessCodes, setVisibleAccessCodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const staffQuery = query(collection(db, "staff"), orderBy("name"));

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toLocaleDateString('id-ID') || 'N/A'
        })) as AppUser[];
        setUsers(usersData);
    }, (error) => console.error("Error fetching users:", error));
    
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const allStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
        setStaff(allStaff.filter(s => s.status === 'active'));
        setPendingStaff(allStaff.filter(s => s.status === 'pending'));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching staff:", error)
        setLoading(false);
    });
    
    return () => {
        unsubUsers();
        unsubStaff();
    };
  }, []);
  
  const handleDeleteUser = async (uid: string) => {
    try {
        await deleteDoc(doc(db, 'users', uid));
        toast({ title: "Berhasil", description: "Akun warga berhasil dihapus." });
    } catch (error) {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus akun warga." });
        console.error("Error deleting user: ", error);
    }
  }


  const handleStaffApproval = async (staffMember: Staff, approved: boolean) => {
    setIsSubmitting(true);
    const staffRef = doc(db, 'staff', staffMember.id);
    try {
        if (approved) {
            await updateDoc(staffRef, { status: 'active', points: 0 });
            await sendStaffAccessCode({
                email: staffMember.email,
                name: staffMember.name,
                accessCode: staffMember.accessCode
            });
            toast({ title: "Berhasil", description: `${staffMember.name} telah disetujui dan kode akses telah dikirim.` });
        } else {
            // Reject: just delete the document
            await deleteDoc(staffRef);
            toast({ title: "Berhasil", description: `Pendaftaran ${staffMember.name} telah ditolak.` });
        }
    } catch (error) {
        const action = approved ? "menyetujui" : "menolak";
        toast({ variant: "destructive", title: "Gagal", description: `Gagal ${action} pendaftaran.`});
    } finally {
        setIsSubmitting(false);
    }
  }


  const handleDeleteStaff = async (id: string) => {
     try {
      await deleteDoc(doc(db, 'staff', id));
      toast({ title: "Berhasil", description: "Staf berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus data staf." });
      console.error("Delete failed:", error);
    }
  }
  
  const toggleAccessCodeVisibility = (staffId: string) => {
    setVisibleAccessCodes(prev => ({
        ...prev,
        [staffId]: !prev[staffId]
    }));
  };

  const handleToggleBlockUser = async (uid: string, isBlocked: boolean) => {
      const userRef = doc(db, 'users', uid);
      try {
        await updateDoc(userRef, { isBlocked: !isBlocked });
        toast({ title: "Berhasil", description: `Status blokir pengguna telah diperbarui.` });
      } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal memperbarui status pengguna." });
      }
  };


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Pengguna</CardTitle>
        <CardDescription>Kelola warga yang terdaftar dan staf (petugas) di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Warga</TabsTrigger>
            <TabsTrigger value="staff">Staf Aktif</TabsTrigger>
            <TabsTrigger value="pending-staff">
                Persetujuan Staf {pendingStaff.length > 0 && <Badge className="ml-2">{pendingStaff.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-40" /></div></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={user.photoURL || undefined} /><AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{user.displayName || 'Tanpa Nama'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.isBlocked ? 'destructive' : 'secondary'}>
                            {user.isBlocked ? 'Diblokir' : 'Aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" size="sm" onClick={() => handleToggleBlockUser(user.uid, !!user.isBlocked)}>
                                    {user.isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                                    <span className="ml-2 hidden sm:inline">{user.isBlocked ? 'Buka Blokir' : 'Blokir'}</span>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-lg">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Warga?</AlertDialogTitle>
                                            <AlertDialogDescription>Tindakan ini akan menghapus akun warga secara permanen dan tidak dapat dibatalkan.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteUser(user.uid)}>Hapus Akun</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">Belum ada warga terdaftar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Poin</TableHead>
                            <TableHead>Kode Akses</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : staff.length > 0 ? (
                            staff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>{s.email}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center font-bold">
                                            <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-400" />
                                            {s.points || 0}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {visibleAccessCodes[s.id] ? (
                                                <span className="font-mono">{s.accessCode}</span>
                                            ) : (
                                                <span className="font-mono">••••••••</span>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleAccessCodeVisibility(s.id)}>
                                                {visibleAccessCodes[s.id] ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-lg">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Hapus Staf?</AlertDialogTitle>
                                                    <AlertDialogDescription>Tindakan ini akan menghapus staf secara permanen.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteStaff(s.id)}>Hapus</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">Belum ada staf aktif.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

          <TabsContent value="pending-staff" className="mt-4">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Email & HP</TableHead>
                            <TableHead>Alamat</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 1 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : pendingStaff.length > 0 ? (
                            pendingStaff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{s.email}</span>
                                            <span className="text-xs text-muted-foreground">{s.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{s.addressDetail}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button size="sm" onClick={() => handleStaffApproval(s, true)} disabled={isSubmitting}>
                                                <Check className="h-4 w-4 mr-2" /> Setujui
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleStaffApproval(s, false)} disabled={isSubmitting}>
                                                <X className="h-4 w-4 mr-2" /> Tolak
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Tidak ada pendaftaran staf yang tertunda.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
    </>
  );
}
