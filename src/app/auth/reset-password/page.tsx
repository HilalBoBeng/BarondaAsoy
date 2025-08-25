
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuth, updatePassword, type User } from "firebase/auth";
import { app } from "@/lib/firebase/client";
import Image from "next/image";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Kata sandi minimal 8 karakter."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    // This page should only be accessed after OTP verification for password reset.
    const storedEmail = localStorage.getItem('resetPasswordEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Verifikasi email diperlukan untuk mengatur ulang kata sandi.',
      });
      router.replace('/auth/forgot-password');
    }
  }, [router, toast]);
  
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!auth.currentUser) {
        toast({
            variant: "destructive",
            title: "Gagal",
            description: "Anda harus masuk untuk mengubah kata sandi. Silakan coba masuk lagi.",
        });
        router.push('/auth/login');
        return;
    }
    
    // Double check if the logged in user email matches the one from OTP flow
    if(auth.currentUser.email !== email) {
        toast({
            variant: "destructive",
            title: "Gagal",
            description: "Terjadi ketidakcocokan sesi. Silakan coba lagi dari awal.",
        });
        router.push('/auth/forgot-password');
        return;
    }


    setIsSubmitting(true);
    try {
        await updatePassword(auth.currentUser, data.password);
        
        toast({
          title: "Berhasil",
          description: "Kata sandi Anda telah berhasil diperbarui. Silakan masuk kembali.",
        });
        
        localStorage.removeItem('resetPasswordEmail');
        auth.signOut();
        router.push('/auth/login');
      
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Gagal Mengatur Ulang",
        description: "Sesi Anda mungkin telah kedaluwarsa. Silakan coba masuk dan ubah kata sandi dari pengaturan, atau ulangi proses lupa kata sandi.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atur Ulang Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan kata sandi baru Anda untuk akun {email}.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi Baru</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Kata Sandi Baru</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting || !email}>
                 {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Atur Ulang Kata Sandi
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="underline">
                  Kembali ke Halaman Masuk
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
