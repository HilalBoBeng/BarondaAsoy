
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: string; 
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const usersData = querySnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate().toLocaleDateString('id-ID') || 'N/A'
            })) as AppUser[];
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ variant: 'destructive', title: "Gagal Memuat Pengguna", description: "Tidak dapat mengambil data warga. Pastikan koleksi 'users' ada di Firestore." });
        } finally {
            setLoading(false);
        }
    };
    fetchUsers();
  }, [toast]);
  

  const handleDelete = async (uid: string) => {
    // This only deletes from Firestore, not from Firebase Auth.
    // Deleting from Auth requires a Cloud Function for security reasons.
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(prevUsers => prevUsers.filter(user => user.uid !== uid));
      toast({ title: "Berhasil", description: "Pengguna berhasil dihapus dari Firestore." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus data pengguna." });
      console.error("Delete failed:", error);
    }
  };

  const renderActions = (user: AppUser) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini hanya akan menghapus data pengguna dari database Firestore, bukan dari sistem otentikasi Firebase.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDelete(user.uid)}>Hapus</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Warga</CardTitle>
        <CardDescription>Lihat dan kelola data warga yang terdaftar di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
         {/* Mobile View */}
        <div className="sm:hidden space-y-4">
            {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
            ) : users.length > 0 ? (
                users.map((user) => (
                    <Card key={user.uid}>
                        <CardContent className="p-4 flex items-start gap-4">
                            <Avatar>
                                <AvatarImage src={user.photoURL || undefined} />
                                <AvatarFallback><UserIcon /></AvatarFallback>
                            </Avatar>
                            <div className="flex-grow">
                                <p className="font-semibold">{user.displayName || 'Tanpa Nama'}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> {user.email}</p>
                                <p className="text-xs text-muted-foreground mt-2">Terdaftar: {user.createdAt}</p>
                            </div>
                            <div className="flex-shrink-0">
                                {renderActions(user)}
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center py-12 text-muted-foreground">Belum ada pengguna terdaftar.</div>
            )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tanggal Registrasi</TableHead>
                <TableHead className="text-right w-[50px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-40" /></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={user.photoURL || undefined} />
                          <AvatarFallback><UserIcon /></AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.displayName || 'Tanpa Nama'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.createdAt}</TableCell>
                    <TableCell className="text-right">
                      {renderActions(user)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    Belum ada pengguna terdaftar di koleksi 'users'.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

    