
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { getAuth, deleteUser } from 'firebase/auth'; // We need auth instance for more complex operations
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// This is a simplified user type from what Firebase Auth provides
interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // We'll fetch custom data like registration date from Firestore
  createdAt?: string; 
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // NOTE: Listing users is a privileged operation not directly available in the client-side SDK.
  // A production app would require a Cloud Function to list users.
  // For this prototype, we'll fetch from a 'users' collection in Firestore, 
  // which you would populate upon user creation.
  useEffect(() => {
    const fetchUsers = async () => {
        setLoading(true);
        try {
            // This assumes you have a 'users' collection where you store user details
            // when they register.
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
            toast({ variant: 'destructive', title: "Gagal Memuat Pengguna", description: "Tidak dapat mengambil data warga. Ini bisa terjadi jika koleksi 'users' belum ada di Firestore." });
        } finally {
            setLoading(false);
        }
    };
    fetchUsers();
  }, [toast]);
  

  const handleDelete = async (uid: string) => {
    // Deleting a user from Auth is also a privileged operation and requires a Cloud Function.
    // We will simulate this by only deleting their record from Firestore.
    try {
      await deleteDoc(doc(db, 'users', uid));
      // Refresh list locally
      setUsers(prevUsers => prevUsers.filter(user => user.uid !== uid));
      toast({ title: "Berhasil", description: "Pengguna berhasil dihapus dari Firestore." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus data pengguna." });
      console.error("Delete failed:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Warga</CardTitle>
        <CardDescription>Lihat dan kelola data warga yang terdaftar di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tanggal Registrasi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-40" /></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
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
