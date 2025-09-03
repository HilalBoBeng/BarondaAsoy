
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
import { sendOtp } from "@/ai/flows/send-otp";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

function ForgotPasswordForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showResetPasswordAlert, setShowResetPasswordAlert] = useState(false);
  
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    const emailForReset = searchParams.get('email');
    const resetAlert = searchParams.get('resetAlert');
    if (emailForReset) {
      form.setValue('email', emailForReset);
    }
     if (resetAlert === 'true') {
      setShowResetPasswordAlert(true);
    }
  }, [searchParams, form]);


  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      const usersQuery = query(collection(db, "users"), where("email", "==", data.email));
      const usersSnapshot = await getDocs(usersQuery);

      if (usersSnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Email tidak terdaftar sebagai pengguna.",
        });
        setIsSubmitting(false);
        return;
      }

      const result = await sendOtp({ email: data.email, context: 'userRegistration' }); 
      if (result.success) {
        toast({
          title: "Berhasil",
          description: "Kode OTP untuk mengatur ulang kata sandi telah dikirim ke email Anda.",
        });
        
        localStorage.setItem('verificationContext', JSON.stringify({ email: data.email, flow: 'userPasswordReset' }));
        router.push('/auth/verify-otp');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Gagal Mengirim OTP",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
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
      {showResetPasswordAlert && (
          <Alert variant="destructive" className="mb-4 animate-fade-in">
              <AlertTitle>Terlalu Banyak Percobaan Login Gagal</AlertTitle>
              <AlertDescription>
                Demi keamanan, silakan atur ulang kata sandi Anda.
              </AlertDescription>
          </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Lupa Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan email Anda untuk menerima kode OTP untuk mengatur ulang kata sandi Anda.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@anda.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Kirim Kode OTP
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-primary hover:text-primary/80">
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


export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ForgotPasswordForm />
        </Suspense>
    )
}
