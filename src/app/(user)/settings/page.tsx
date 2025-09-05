
"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Mail, KeyRound, Loader2, AtSign, LogIn, Home, ArrowLeft, Trash2, UserCircle, MessageSquare, Settings, Megaphone, Shield } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useState, useEffect, useCallback } from 'react'
import { useToast } from "@/hooks/use-toast"
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword, signOut, deleteUser } from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { db } from "@/lib/firebase/client"
import { doc, deleteDoc } from "firebase/firestore"
import { cn } from "@/lib/utils"

// Schemas
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini harus diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi kata sandi baru tidak cocok.",
    path: ["confirmNewPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Kata sandi diperlukan untuk konfirmasi."),
  captcha: z.string().min(1, "Captcha harus diisi."),
});
type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;

export default function SettingsPage() {
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const { toast } = useToast();
  const auth = getAuth();
  const router = useRouter();
  const pathname = usePathname();
  const user = auth.currentUser;

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });
  const deleteAccountForm = useForm<DeleteAccountFormValues>({ resolver: zodResolver(deleteAccountSchema) });

  const generateCaptcha = useCallback(() => {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCaptcha(randomString);
    deleteAccountForm.reset({ password: '', captcha: '' });
  }, [deleteAccountForm]);

  useEffect(() => {
    if (isDeleteAlertOpen) {
      generateCaptcha();
    }
  }, [isDeleteAlertOpen, generateCaptcha]);
  
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user || !user.email) return;
    setIsPasswordSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast({ title: "Berhasil", description: "Kata sandi Anda berhasil diubah." });
      passwordForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Kata sandi saat ini salah atau terjadi kesalahan lain." });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const onDeleteAccount = async (data: DeleteAccountFormValues) => {
    if (!user || !user.email) return;
    
    if (data.captcha !== captcha) {
        deleteAccountForm.setError("captcha", { type: "manual", message: "Captcha tidak cocok." });
        generateCaptcha(); // Regenerate captcha on failure
        return;
    }

    setIsDeleting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.password);
      await reauthenticateWithCredential(user, credential);
      
      const userId = user.uid;

      // Delete user from Auth
      await deleteUser(user);

      // Delete user data from Firestore
      const userDocRef = doc(db, 'users', userId);
      await deleteDoc(userDocRef);

      toast({ title: "Akun Dihapus", description: "Akun Anda telah berhasil dihapus secara permanen." });
      setIsDeleteAlertOpen(false);
      router.push('/');

    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Kata sandi salah atau terjadi kesalahan." });
        generateCaptcha();
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Pengaturan Akun</CardTitle>
                <CardDescription>Kelola detail dan keamanan akun Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {user ? (
                <>
                  <Form {...passwordForm}>
                      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5" />Ubah Kata Sandi</h3>
                          <FormField
                              control={passwordForm.control}
                              name="currentPassword"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Kata Sandi Saat Ini</FormLabel>
                                      <FormControl><Input type="password" {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={passwordForm.control}
                              name="newPassword"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Kata Sandi Baru</FormLabel>
                                      <FormControl><Input type="password" {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={passwordForm.control}
                              name="confirmNewPassword"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Konfirmasi Kata Sandi Baru</FormLabel>
                                      <FormControl><Input type="password" {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <Button type="submit" disabled={isPasswordSubmitting}>
                              {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Simpan Kata Sandi
                          </Button>
                      </form>
                  </Form>
                  <Separator />
                  
                   <div>
                    <h3 className="font-semibold text-destructive flex items-center gap-2 mb-2"><Trash2 className="h-5 w-5" />Hapus Akun</h3>
                     <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                  Hapus Akun Saya Secara Permanen
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      Tindakan ini tidak dapat dibatalkan. Semua data Anda akan dihapus permanen. Masukkan kata sandi dan captcha untuk konfirmasi.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Form {...deleteAccountForm}>
                                  <form onSubmit={deleteAccountForm.handleSubmit(onDeleteAccount)} className="space-y-4">
                                       <div className="flex items-center justify-center space-x-2 my-4">
                                            <span className="text-2xl font-bold tracking-widest bg-muted p-3 rounded-md select-none">
                                                {captcha}
                                            </span>
                                            <Button type="button" variant="outline" size="sm" onClick={generateCaptcha}>Refresh</Button>
                                        </div>
                                      <FormField
                                          control={deleteAccountForm.control}
                                          name="captcha"
                                          render={({ field }) => (
                                          <FormItem>
                                              <FormLabel>Ketik Ulang Teks di Atas</FormLabel>
                                              <FormControl><Input {...field} autoComplete="off" /></FormControl>
                                              <FormMessage />
                                          </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={deleteAccountForm.control}
                                          name="password"
                                          render={({ field }) => (
                                          <FormItem>
                                              <FormLabel>Kata Sandi Anda</FormLabel>
                                              <FormControl><Input type="password" {...field} /></FormControl>
                                              <FormMessage />
                                          </FormItem>
                                          )}
                                      />
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Batal</AlertDialogCancel>
                                          <Button type="submit" variant="destructive" disabled={isDeleting}>
                                              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                              Ya, Hapus Akun Saya
                                          </Button>
                                      </AlertDialogFooter>
                                  </form>
                              </Form>
                          </AlertDialogContent>
                      </AlertDialog>
                   </div>
                </>
              ) : (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                  <p className="mb-4 text-muted-foreground">Masuk untuk mengubah pengaturan akun Anda.</p>
                  <Button asChild>
                      <Link href="/auth/login">
                          <LogIn className="mr-2 h-4 w-4" />
                          Masuk
                      </Link>
                  </Button>
                </div>
              )}
            </CardContent>
        </Card>
    </div>
  )
}
