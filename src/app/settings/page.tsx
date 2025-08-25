
"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Moon, Sun, Mail, KeyRound, Loader2, AtSign } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useState, useEffect } from 'react'
import { useToast } from "@/hooks/use-toast"
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"

// Schemas
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini harus diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
});
type PasswordFormValues = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  newEmail: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi diperlukan untuk verifikasi."),
});
type EmailFormValues = z.infer<typeof emailSchema>;


export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const { toast } = useToast();
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });
  const emailForm = useForm<EmailFormValues>({ resolver: zodResolver(emailSchema) });

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user || !user.email) return;
    setIsPasswordSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast({ title: "Berhasil", description: "Kata sandi Anda telah berhasil diubah." });
      passwordForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Kata sandi saat ini salah atau terjadi kesalahan lain." });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const onEmailSubmit = async (data: EmailFormValues) => {
    if (!user || !user.email) return;
    setIsEmailSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.password);
      await reauthenticateWithCredential(user, credential);

      // In a real app, you would now trigger a Genkit flow to send an OTP to the new email.
      // For this simulation, we'll assume the OTP is verified and proceed.
      // await sendChangeEmailOtp({ newEmail: data.newEmail, userId: user.uid });
      
      // Store context and redirect to OTP page
      localStorage.setItem('verificationContext', JSON.stringify({
          flow: 'changeEmail',
          email: user.email, // old email for re-auth
          newEmail: data.newEmail,
          password: data.password // for re-auth after OTP
      }));

      toast({ title: "Verifikasi Diperlukan", description: `Kode OTP telah dikirim ke ${data.newEmail}.` });
      router.push('/auth/verify-otp');

    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Kata sandi salah atau terjadi kesalahan." });
    } finally {
      setIsEmailSubmitting(false);
    }
  };
  
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
          <h1 className="text-lg sm:text-xl font-bold text-primary">
            Pengaturan
          </h1>
          <Button asChild variant="outline">
            <Link href="/">
              Kembali ke Halaman Utama
            </Link>
          </Button>
       </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
             <div className="mx-auto max-w-2xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Pengaturan Akun</CardTitle>
                        <CardDescription>Ubah kata sandi atau email Anda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Change Password */}
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
                                <Button type="submit" disabled={isPasswordSubmitting}>
                                    {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Kata Sandi
                                </Button>
                            </form>
                        </Form>

                        <Separator />

                        {/* Change Email */}
                        <Form {...emailForm}>
                             <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2"><AtSign className="h-5 w-5" />Ubah Email</h3>
                                 <FormField
                                    control={emailForm.control}
                                    name="newEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Baru</FormLabel>
                                            <FormControl><Input type="email" placeholder="email.baru@contoh.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={emailForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Verifikasi Kata Sandi</FormLabel>
                                            <FormControl><Input type="password" placeholder="Masukkan kata sandi Anda saat ini" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <Button type="submit" disabled={isEmailSubmitting}>
                                    {isEmailSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Lanjutkan ke Verifikasi
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                    <CardTitle>Pengaturan Tampilan</CardTitle>
                    <CardDescription>
                        Pilih tema tampilan untuk aplikasi.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <h3 className="font-medium">Tema Aplikasi</h3>
                                <p className="text-sm text-muted-foreground">
                                    Pilih antara mode terang atau gelap.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant={theme === 'light' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("light")}>
                                    <Sun className="h-5 w-5" />
                                    <span className="sr-only">Light</span>
                                </Button>
                                <Button variant={theme === 'dark' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("dark")}>
                                    <Moon className="h-5 w-5" />
                                    <span className="sr-only">Dark</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
        <footer className="border-t bg-background py-6 text-center text-sm text-muted-foreground px-4">
            <div className="space-y-2">
                <p>© {new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.</p>
                <div className="flex justify-center">
                    <a href="mailto:admin@bobeng.icu" className="inline-flex items-center gap-2 text-primary hover:underline">
                        <Mail className="h-4 w-4" />
                        <span>Hubungi Admin</span>
                    </a>
                </div>
            </div>
        </footer>
    </div>
  )
}
