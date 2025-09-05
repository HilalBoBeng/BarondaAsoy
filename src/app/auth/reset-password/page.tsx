
"use client";

import { useEffect, useState } from 'react';
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { resetUserPassword } from '@/ai/flows/reset-user-password';


const passwordSchema = z.object({
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi kata sandi baru tidak cocok.",
    path: ["confirmNewPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const contextStr = localStorage.getItem('verificationContext');
    if (contextStr) {
      const context = JSON.parse(contextStr);
      if (context.flow === 'userPasswordReset' && context.email) {
        setEmail(context.email);
      } else {
        redirectToLogin();
      }
    } else {
      redirectToLogin();
    }
  }, [router, toast]);
  
  const redirectToLogin = () => {
    toast({
        variant: "destructive",
        title: "Sesi Tidak Valid",
        description: "Silakan mulai proses lupa kata sandi dari awal.",
      });
      router.replace('/auth/login');
  }

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormValues) => {
    if (!email) {
        redirectToLogin();
        return;
    }

    setIsSubmitting(true);
    try {
        const result = await resetUserPassword({ email, newPassword: data.newPassword });
        if(result.success) {
            toast({
                title: "Berhasil",
                description: "Kata sandi Anda telah berhasil diubah. Silakan masuk kembali.",
            });
            localStorage.removeItem('verificationContext');
            router.push('/auth/login');
        } else {
            throw new Error(result.message);
        }
      
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Gagal Mengubah Kata Sandi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!email) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <div className="space-y-4">
        <div className="text-center space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Atur Ulang Kata Sandi</h2>
            <p className="text-sm text-muted-foreground">
                Masukkan kata sandi baru Anda untuk email {email}.
            </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi Baru</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Kata Sandi Baru</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Kata Sandi Baru
              </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
