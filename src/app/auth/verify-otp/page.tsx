"use client";

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { BarondaLogo } from '@/components/icons';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { verifyOtp } from '@/ai/flows/verify-otp';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { app } from '@/lib/firebase/client';

const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'Kode OTP harus 6 digit.'),
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export default function VerifyOtpPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationContext, setVerificationContext] = useState<any>(null);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const contextStr = localStorage.getItem('verificationContext');
    if (contextStr) {
      setVerificationContext(JSON.parse(contextStr));
    } else {
      // If no context, redirect to register
      router.replace('/auth/register');
    }
  }, [router]);

  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: '' },
  });

  const onSubmit = async (data: VerifyOtpFormValues) => {
    if (!verificationContext) {
        toast({ variant: 'destructive', title: 'Kesalahan', description: 'Sesi verifikasi tidak ditemukan.' });
        return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyOtp({ email: verificationContext.email, otp: data.otp });

      if (result.success) {
        toast({ title: 'Berhasil', description: 'Verifikasi OTP berhasil.' });
        localStorage.removeItem('verificationContext'); // Clean up

        if (verificationContext.flow === 'register') {
          // Create user in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            verificationContext.email,
            verificationContext.password
          );
          await updateProfile(userCredential.user, {
            displayName: verificationContext.name,
          });
          toast({ title: 'Pendaftaran Berhasil', description: 'Akun Anda telah dibuat. Silakan masuk.' });
          router.push('/auth/login');

        } else if (verificationContext.flow === 'resetPassword') {
          // Redirect to reset password page
          localStorage.setItem('resetPasswordEmail', verificationContext.email);
          router.push('/auth/reset-password');
        }

      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verifikasi Gagal',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-center mb-6">
        <BarondaLogo className="h-16 w-auto" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Verifikasi Kode OTP</CardTitle>
          <CardDescription>
            Masukkan 6 digit kode yang kami kirimkan ke email {verificationContext?.email || 'Anda'}.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode OTP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••"
                        maxLength={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting || !verificationContext}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verifikasi
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
