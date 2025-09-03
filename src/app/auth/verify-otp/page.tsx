
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { verifyOtp } from "@/ai/flows/verify-otp";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const verifyOtpSchema = z.object({
  otp: z.string().min(6, "Kode OTP harus 6 digit."),
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export default function VerifyOtpPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const router = useRouter();
  
  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: "" },
  });

  const getCooldownKey = (email: string) => `otpCooldown_${email}`;

  const getCooldownData = useCallback(() => {
    if (typeof window === 'undefined' || !registrationData?.email) return null;
    const data = localStorage.getItem(getCooldownKey(registrationData.email));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }, [registrationData?.email]);

  useEffect(() => {
    const dataStr = localStorage.getItem('registrationData');
    if (!dataStr) {
      toast({
        variant: "destructive",
        title: "Data Tidak Ditemukan",
        description: "Silakan mulai proses pendaftaran dari awal.",
      });
      router.push('/auth/register');
    } else {
      setRegistrationData(JSON.parse(dataStr));
    }
  }, [router, toast]);
  
  useEffect(() => {
    const savedCooldown = getCooldownData();
    if (savedCooldown) {
      const now = new Date().getTime();
      const remaining = Math.ceil((savedCooldown.expiry - now) / 1000);
      if (remaining > 0) {
        setCooldown(remaining);
        setResendAttempts(savedCooldown.attempts);
      } else {
        if (registrationData?.email) localStorage.removeItem(getCooldownKey(registrationData.email));
      }
    }
  }, [registrationData, getCooldownData]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
            if(prev - 1 <= 0) {
                if (registrationData?.email) localStorage.removeItem(getCooldownKey(registrationData.email));
                return 0;
            }
            return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown, registrationData]);

  const handleResendOtp = async () => {
    if (!registrationData) return;
    setIsResending(true);
    try {
      const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: registrationData.email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({ title: "Berhasil", description: "Kode OTP baru telah dikirim." });

      const newAttempts = resendAttempts + 1;
      setResendAttempts(newAttempts);

      let newCooldown = 60; // 1 minute
      if (newAttempts === 2) newCooldown = 180; // 3 minutes
      else if (newAttempts > 2) newCooldown = 300; // 5 minutes

      setCooldown(newCooldown);
      const expiry = new Date().getTime() + newCooldown * 1000;
      localStorage.setItem(getCooldownKey(registrationData.email), JSON.stringify({ expiry, attempts: newAttempts }));

    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Mengirim Ulang", description: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: VerifyOtpFormValues) => {
    if (!registrationData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Sesi registrasi tidak valid.'});
        return;
    }
    setIsSubmitting(true);
    try {
      const result = await verifyOtp({ 
        otp: data.otp,
        email: registrationData.email,
        name: registrationData.name,
        password: registrationData.password,
      });

      if (result.success) {
        toast({
          title: "Verifikasi Berhasil",
          description: "Akun Anda telah berhasil dibuat. Silakan masuk.",
        });
        localStorage.removeItem('registrationData');
        if (registrationData?.email) localStorage.removeItem(getCooldownKey(registrationData.email));
        router.push('/auth/login');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Verifikasi Gagal",
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
          <CardTitle>Verifikasi Email Anda</CardTitle>
          <CardDescription>
            Kami telah mengirimkan kode 6 digit ke email <strong>{registrationData?.email}</strong>. Masukkan kode tersebut di bawah ini.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode OTP</FormLabel>
                    <FormControl>
                        <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                            </InputOTPGroup>
                        </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <Button 
                    type="button" 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={handleResendOtp}
                    disabled={isResending || cooldown > 0}
                >
                    {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : "Kirim ulang OTP"}
                </Button>

            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                 {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verifikasi & Daftar
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/register" className="underline">
                  Kembali untuk mengubah email
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
