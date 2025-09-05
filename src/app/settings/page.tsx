
"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Mail, KeyRound, Loader2, AtSign, LogIn, Home, ArrowLeft, Trash2, UserCircle, MessageSquare, Settings } from "lucide-react"
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
import FloatingChatButton from "@/components/dashboard/floating-chat-button"

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

const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/chat", icon: MessageSquare, label: "Pesan" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
]

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
  
  const handleLogout = () => {
    signOut(auth).then(() => {
      router.push('/auth/login');
    });
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user || !user.email) return;
    setIsPasswordSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast({ title: "Berhasil", description: "Kata sandi diubah. Silakan masuk kembali." });
      passwordForm.reset();
      setTimeout(handleLogout, 2000);
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
    <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
          <h1 className="text-lg font-semibold">Pengaturan</h1>
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
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20">
             <div className="mx-auto max-w-2xl space-y-8">
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
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-4 items-center justify-center gap-2 px-2">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            pathname === item.href ? "text-primary bg-primary/10" : "text-muted-foreground"
                            )}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </Button>
                    </Link>
                ))}
            </div>
        </nav>
        {user && <FloatingChatButton />}
    </div>
  )
}
