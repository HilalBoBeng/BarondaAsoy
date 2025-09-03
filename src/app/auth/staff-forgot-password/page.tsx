
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
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function StaffForgotPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const router = useRouter();
  
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const email = form.watch('email');

  const getCooldownData = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem('otpCooldown');
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed.email === email && parsed.expiry && typeof parsed.attempts !== 'undefined') {
        return parsed;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [email]);

   useEffect(() => {
    if (!email) return;

    const savedCooldown = getCooldownData();
    if (savedCooldown) {
        const now = new Date().getTime();
        const remaining = Math.ceil((savedCooldown.expiry - now) / 1000);
        if (remaining > 0) {
            setCooldown(remaining);
            setResendAttempts(savedCooldown.attempts);
        } else {
            localStorage.removeItem('otpCooldown');
        }
    }
  }, [email, getCooldownData]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prevCooldown) => {
            if(prevCooldown - 1 <= 0) {
                localStorage.removeItem('otpCooldown');
                return 0;
            }
            return prevCooldown - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);


  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      // Check if staff email exists
      const staffQuery = query(collection(db, "staff"), where("email", "==", data.email));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Email tidak terdaftar sebagai petugas.",
        });
        setIsSubmitting(false);
        return;
      }

      const result = await sendOtp({ email: data.email, context: 'staffResetPassword' });
      if (result.success) {
        toast({
          title: "Berhasil",
          description: "Kode OTP telah dikirim ke email Anda.",
        });

        const newAttempts = resendAttempts + 1;
        setResendAttempts(newAttempts);

        let newCooldown = 0;
        if (newAttempts === 1) newCooldown = 60; // 1 minute
        else if (newAttempts === 2) newCooldown = 180; // 3 minutes
        else newCooldown = 300; // 5 minutes

        setCooldown(newCooldown);
        const expiry = new Date().getTime() + newCooldown * 1000;
        localStorage.setItem('otpCooldown', JSON.stringify({ email: data.email, expiry, attempts: newAttempts }));


        localStorage.setItem('verificationContext', JSON.stringify({ email: data.email, flow: 'staffResetPassword' }));
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
      <Card>
        <CardHeader>
          <CardTitle>Lupa Sandi Petugas</CardTitle>
          <CardDescription>
            Masukkan email petugas Anda untuk menerima kode OTP untuk verifikasi. Kode akses Anda akan dikirimkan kembali.
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
                      <Input placeholder="email@petugas.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting || cooldown > 0}>
                 {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {cooldown > 0 ? `Kirim Ulang dalam ${cooldown}s` : 'Kirim Kode OTP'}
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/staff-login" className="underline">
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
