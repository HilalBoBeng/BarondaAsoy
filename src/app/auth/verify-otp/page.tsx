
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
import { useEffect, useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { verifyOtp } from '@/ai/flows/verify-otp';
import { sendOtp } from '@/ai/flows/send-otp';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { app, db } from '@/lib/firebase/client';
import { setDoc, doc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { resetStaffPassword } from '@/ai/flows/reset-staff-password';
import Image from 'next/image';

const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'Kode OTP harus 6 digit.'),
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export default function VerifyOtpPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationContext, setVerificationContext] = useState<any>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isStaffFlow, setIsStaffFlow] = useState(false);
  const [isStaffResetFlow, setIsStaffResetFlow] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [cooldown, setCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);

  const getCooldownData = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem('otpCooldown');
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed.email === verificationContext?.email && parsed.expiry && typeof parsed.attempts !== 'undefined') {
        return parsed;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [verificationContext?.email]);

  useEffect(() => {
    const contextStr = localStorage.getItem('verificationContext');
    if (contextStr) {
      setVerificationContext(JSON.parse(contextStr));
    } else {
        router.push('/auth/login');
    }
  }, [router]);

  useEffect(() => {
    if (!verificationContext) return;

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
  }, [verificationContext, getCooldownData]);

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

  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: '' },
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target;
    if (!/^\d*$/.test(value)) return;

    let currentOtp = form.getValues('otp') || '';
    let otpArray = currentOtp.split('');
    otpArray[index] = value.slice(-1);
    form.setValue('otp', otpArray.join(''));

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !form.getValues('otp')[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  const handleResendOtp = async () => {
    if (!verificationContext || cooldown > 0) return;
    let emailToSend = verificationContext.email;

    setIsSubmitting(true);
    try {
        const result = await sendOtp({ email: emailToSend, context: verificationContext.flow });
        if (result.success) {
            toast({
                title: "Kode Terkirim",
                description: "Kode OTP baru telah dikirim ke email Anda.",
            });
            const newAttempts = resendAttempts + 1;
            setResendAttempts(newAttempts);

            let newCooldown = 0;
            if (newAttempts === 1) newCooldown = 60;
            else if (newAttempts === 2) newCooldown = 180;
            else newCooldown = 300;

            setCooldown(newCooldown);
            const expiry = new Date().getTime() + newCooldown * 1000;
            localStorage.setItem('otpCooldown', JSON.stringify({ email: verificationContext.email, expiry, attempts: newAttempts }));

        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Gagal Mengirim Ulang",
            description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const onSubmit = async (data: VerifyOtpFormValues) => {
    if (!verificationContext) {
        toast({ variant: 'destructive', title: 'Kesalahan', description: 'Sesi verifikasi tidak ditemukan.' });
        return;
    }
    
    let emailToVerify = verificationContext.email;

    setIsSubmitting(true);
    try {
      const result = await verifyOtp({ email: emailToVerify, otp: data.otp });

      if (result.success) {
        toast({ title: 'Berhasil', description: 'Verifikasi OTP berhasil.' });
        localStorage.removeItem('verificationContext');
        localStorage.removeItem('otpCooldown');

        if (verificationContext.flow === 'register') {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            verificationContext.email,
            verificationContext.password
          );

          await updateProfile(userCredential.user, {
            displayName: verificationContext.name,
          });

          await setDoc(doc(db, "users", userCredential.user.uid), {
            displayName: verificationContext.name,
            email: verificationContext.email,
            phone: '',
            address: '',
            photoURL: '',
            createdAt: serverTimestamp(),
            isBlocked: false,
          });
          
          toast({ title: 'Pendaftaran Berhasil', description: 'Akun Anda telah dibuat. Silakan masuk.' });
          router.push('/auth/login');

        } else if (verificationContext.flow === 'resetPassword') {
          localStorage.setItem('resetPasswordEmail', verificationContext.email);
          router.push('/auth/reset-password');

        } else if (verificationContext.flow === 'staffRegister') {
            const accessCode = Math.random().toString(36).substring(2, 17).toUpperCase();
            await addDoc(collection(db, 'staff'), {
                name: verificationContext.name,
                email: verificationContext.email,
                phone: verificationContext.phone,
                addressType: verificationContext.addressType,
                addressDetail: verificationContext.addressDetail,
                accessCode: accessCode,
                status: 'pending'
            });
            setOtpVerified(true);
            setIsStaffFlow(true);
        } else if (verificationContext.flow === 'staffResetPassword') {
            await resetStaffPassword({ email: verificationContext.email });
            setOtpVerified(true);
            setIsStaffResetFlow(true);
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

  if (otpVerified) {
    let successTitle = "Proses Selesai";
    let successDescription = "Proses telah selesai. Anda dapat kembali ke halaman utama.";
    let buttonText = "Kembali ke Halaman Masuk Staf";
    let buttonLink = "/auth/staff-login";

    if (isStaffFlow) {
      successTitle = "Pendaftaran Sedang Ditinjau";
      successDescription = "Pendaftaran Anda telah berhasil dikirim dan sedang menunggu persetujuan dari admin. PENTING: Kode akses unik Anda untuk login akan dikirimkan ke email Anda hanya setelah pendaftaran Anda disetujui oleh admin. Silakan periksa email Anda secara berkala.";
    } else if (isStaffResetFlow) {
      successTitle = "Kode Akses Baru Terkirim";
      successDescription = "Kode akses baru Anda telah dikirim ulang ke email Anda. Silakan periksa kotak masuk Anda.";
    }
      
    return (
        <>
         <div className="flex flex-col items-center justify-center mb-6 text-center">
            <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
            <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
            <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
         </div>
          <Card>
            <CardHeader>
              <CardTitle>{successTitle}</CardTitle>
              <CardDescription>
                {successDescription}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link href={buttonLink}>{buttonText}</Link>
              </Button>
            </CardFooter>
          </Card>
        </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Verifikasi Kode OTP</CardTitle>
          <CardDescription>
            Masukkan 6 digit kode yang kami kirimkan ke email {
                verificationContext?.email || 'Anda'
            }.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="otp"
                render={() => (
                  <FormItem>
                    <FormLabel className="sr-only">Kode OTP</FormLabel>
                    <FormControl>
                       <div className="flex justify-center gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                           <Input
                            key={index}
                            ref={(el) => (inputRefs.current[index] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            className="w-12 h-14 text-center text-2xl font-bold"
                            value={form.watch('otp')[index] || ''}
                            onChange={(e) => handleInputChange(e, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            />
                        ))}
                       </div>
                    </FormControl>
                    <FormMessage className="text-center pt-2" />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting || !verificationContext}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verifikasi
              </Button>
               <div className="text-center text-sm text-muted-foreground">
                  Tidak menerima kode?{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto"
                    onClick={handleResendOtp}
                    disabled={cooldown > 0 || isSubmitting}
                  >
                    {cooldown > 0 ? `Kirim Ulang dalam ${cooldown}s` : 'Kirim Ulang Kode'}
                  </Button>
               </div>
               <div className="text-center text-sm">
                  <Link href="/auth/login" className="underline">
                      Bukan Anda? Kembali
                  </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
