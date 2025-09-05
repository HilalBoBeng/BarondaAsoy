
"use client";

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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { verifyOtp } from "@/ai/flows/verify-otp";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { sendOtp } from "@/ai/flows/send-otp";

const verifyOtpSchema = z.object({
  otp: z.string().min(6, "Kode OTP harus 6 digit."),
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export default function VerifyOtpPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [contextData, setContextData] = useState<any>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const router = useRouter();
  
  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: "" },
  });

  const getCooldownKey = (email: string) => `otpCooldown_${email}`;

  const getCooldownData = useCallback(() => {
    if (typeof window === 'undefined' || !contextData?.email) return null;
    const data = localStorage.getItem(getCooldownKey(contextData.email));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }, [contextData?.email]);

  useEffect(() => {
    let dataStr: string | null = null;
    if (typeof window !== 'undefined') {
        dataStr = localStorage.getItem('registrationData') || localStorage.getItem('verificationContext');
    }

    if (!dataStr) {
      toast({
        variant: "destructive",
        title: "Data Tidak Ditemukan",
        description: "Silakan mulai proses dari awal.",
      });
      router.push('/auth/login');
    } else {
      setContextData(JSON.parse(dataStr));
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
        if (contextData?.email) localStorage.removeItem(getCooldownKey(contextData.email));
      }
    }
  }, [contextData, getCooldownData]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
            if(prev - 1 <= 0) {
                if (contextData?.email) localStorage.removeItem(getCooldownKey(contextData.email));
                return 0;
            }
            return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown, contextData]);

  const handleResendOtp = async () => {
    if (!contextData) return;
    setIsResending(true);
    try {
      const contextToSend = contextData.flow === 'userPasswordReset' ? 'userRegistration' : (contextData.flow === 'staffRegistration' ? 'staffRegistration' : 'userRegistration');
      
      const result = await sendOtp({ email: contextData.email, context: contextToSend });
      if (!result.success) throw new Error(result.message);

      toast({ title: "Berhasil", description: "Kode OTP baru telah dikirim." });

      const newAttempts = resendAttempts + 1;
      setResendAttempts(newAttempts);

      let newCooldown = 60; // 1 minute
      if (newAttempts === 2) newCooldown = 180; // 3 minutes
      else if (newAttempts > 2) newCooldown = 300; // 5 minutes

      setCooldown(newCooldown);
      const expiry = new Date().getTime() + newCooldown * 1000;
      localStorage.setItem(getCooldownKey(contextData.email), JSON.stringify({ expiry, attempts: newAttempts }));

    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Mengirim Ulang", description: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: VerifyOtpFormValues) => {
    if (!contextData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Sesi verifikasi tidak valid.'});
        return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
    try {
      const result = await verifyOtp({ 
        ...contextData,
        otp: data.otp,
      });

      if (result.success) {
        toast({
          title: "Verifikasi Berhasil",
          description: result.message,
        });
        
        localStorage.removeItem('registrationData');
        localStorage.removeItem('verificationContext');

        if (contextData?.email) localStorage.removeItem(getCooldownKey(contextData.email));
        
        if (contextData.flow === 'userPasswordReset') {
            localStorage.setItem('verificationContext', JSON.stringify({ email: contextData.email, flow: 'userPasswordReset' }));
            router.push('/auth/reset-password');
        } else if (contextData.flow === 'userRegistration') {
            localStorage.setItem('registrationSuccess', 'true');
            router.push('/auth/login');
        } else if (contextData.flow === 'staffRegistration') {
            router.push('/auth/staff-registration-success');
        }
         else {
            router.push('/auth/staff-login');
        }

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
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Verifikasi Email Anda</h2>
          <p className="text-sm text-muted-foreground">
            Kami telah mengirimkan kode 6 digit ke <strong>{contextData?.email}</strong>.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Kode OTP</FormLabel>
                  <FormControl>
                      <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
               {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verifikasi
            </Button>
          </form>
        </Form>
        <div className="text-center text-sm">
            <Button 
                type="button" 
                variant="link" 
                className="p-0 h-auto text-primary hover:text-primary/80"
                onClick={handleResendOtp}
                disabled={isResending || cooldown > 0}
            >
                {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : "Kirim ulang OTP"}
            </Button>
        </div>
      </div>
    </>
  );
}
