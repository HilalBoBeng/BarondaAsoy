
"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Moon, Sun, Mail, KeyRound, Loader2, AtSign, LogIn, Home, ArrowLeft } from "lucide-react"
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
import Image from "next/image"

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


export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const { toast } = useToast();
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser;

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

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

  
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Link>
          </Button>
           <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                  <span className="text-sm font-bold text-primary leading-tight">Baronda</span>
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
        <main className="flex-1 p-4 sm:p-6 md:p-8">
             <div className="mx-auto max-w-2xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Pengaturan Akun</CardTitle>
                        <CardDescription>Ubah kata sandi atau email Anda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {user ? (
                        <>
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
