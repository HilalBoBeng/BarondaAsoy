
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, ShieldAlert, User, Mail, Phone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import type { AppUser } from "@/lib/types";
import { formatDistanceToNow, intervalToDuration } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";


const loginSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi tidak boleh kosong."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type SuspensionInfo = {
    user: AppUser;
    reason: string;
    endDate: Date | null;
    isBlocked: boolean;
};

const formatDuration = (start: Date, end: Date) => {
    const duration = intervalToDuration({ start, end });
    const parts = [];
    if (duration.days) parts.push(`${duration.days} hari`);
    if (duration.hours) parts.push(`${duration.hours} jam`);
    if (duration.minutes) parts.push(`${duration.minutes} menit`);
    if (duration.seconds) parts.push(`${duration.seconds} detik`);
    return parts.join(' ');
};

function LoginForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState<Record<string, number>>({});
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [countdown, setCountdown] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = getAuth(app);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (suspensionInfo && suspensionInfo.endDate) {
        timer = setInterval(() => {
            const now = new Date();
            if (now > suspensionInfo.endDate!) {
                setCountdown("Selesai");
                clearInterval(timer);
            } else {
                setCountdown(formatDuration(now, suspensionInfo.endDate!));
            }
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [suspensionInfo]);

  useEffect(() => {
    const registrationSuccess = localStorage.getItem('registrationSuccess');
    if (registrationSuccess) {
      setShowSuccessMessage(true);
      localStorage.removeItem('registrationSuccess');
    }
    
    const resetAlert = searchParams.get('resetAlert');
    const emailForReset = searchParams.get('email');
    if (resetAlert && emailForReset) {
      toast({
        variant: "destructive",
        title: "Terlalu Banyak Percobaan Login",
        description: "Demi keamanan, silakan atur ulang kata sandi Anda.",
      });
      form.setValue('email', emailForReset);
    }

  }, [searchParams, form, toast]);

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as AppUser;
            const fullUserData = { uid: user.uid, ...userData };

            if (userData.isBlocked) {
                await auth.signOut();
                setSuspensionInfo({ user: fullUserData, reason: "Akun Anda telah diblokir secara permanen oleh admin karena pelanggaran berat.", endDate: null, isBlocked: true });
                setIsSubmitting(false);
                return;
            }
             if (userData.isSuspended) {
                await auth.signOut();
                const endDate = (userData.suspensionEndDate as Timestamp)?.toDate() || null;
                setSuspensionInfo({ user: fullUserData, reason: userData.suspensionReason || 'Tidak ada alasan yang diberikan.', endDate, isBlocked: false });
                setIsSubmitting(false);
                return;
            }
        }
        
        setLoginAttempts(prev => ({...prev, [data.email]: 0}));
        toast({
            title: "Login Berhasil",
            description: "Selamat datang kembali!",
        });
        sessionStorage.setItem('showWelcomePopup', 'true');
        router.push("/");
    } catch (error) {
       const currentAttempts = (loginAttempts[data.email] || 0) + 1;
       setLoginAttempts(prev => ({...prev, [data.email]: currentAttempts}));

       if (currentAttempts >= 3) {
            router.push(`/auth/forgot-password?email=${encodeURIComponent(data.email)}&resetAlert=true`);
       } else {
            toast({
                variant: "destructive",
                title: "Login Gagal",
                description: `Email atau kata sandi salah. Sisa percobaan: ${3 - currentAttempts}.`,
            });
       }
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
     <>
      <div className="flex flex-col items-center justify-center text-center">
        <Link href="/auth/staff-login">
          <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto mb-4" />
        </Link>
        <h1 className="text-2xl font-bold">Selamat Datang Kembali</h1>
        <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan ke Baronda.</p>
      </div>
       {showSuccessMessage && (
        <Alert className="mt-6 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 [&>svg]:text-green-600 animate-fade-in">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Registrasi Berhasil!</AlertTitle>
            <AlertDescription>
            Akun Anda telah berhasil dibuat. Silakan masuk.
            </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="password" placeholder="Kata Sandi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <div className="text-right">
            <Button asChild variant="link" size="sm" className="px-0">
               <Link href="/auth/forgot-password">
                Lupa kata sandi?
              </Link>
            </Button>
          </div>
           <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Masuk
            </Button>
        </form>
      </Form>
       <div className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link
              href="/auth/register"
              className="font-semibold text-primary hover:text-primary/80 no-underline"
          >
              Daftar di sini
          </Link>
      </div>

      <Dialog open={!!suspensionInfo} onOpenChange={() => setSuspensionInfo(null)}>
        <DialogContent className="sm:max-w-md text-center">
            <DialogHeader className="items-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <ShieldAlert className="h-7 w-7 text-destructive" />
              </div>
              <DialogTitle className="text-2xl text-foreground">
                  Akun {suspensionInfo?.isBlocked ? 'Diblokir' : 'Ditangguhkan'}
              </DialogTitle>
              <DialogDescription className="text-center px-4">
                  Akses Anda ke aplikasi telah {suspensionInfo?.isBlocked ? 'diblokir secara permanen' : 'ditangguhkan sementara'} oleh admin.
              </DialogDescription>
            </DialogHeader>
           <div className="space-y-4 py-4 text-sm">
                <div className="space-y-2 rounded-md border p-4 text-left">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{suspensionInfo?.user.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{suspensionInfo?.user.email}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{suspensionInfo?.user.phone || 'No. HP tidak tersedia'}</span>
                    </div>
                </div>

                <div className="text-center">
                    <h4 className="font-semibold">Alasan:</h4>
                    <p className="text-destructive font-bold">{suspensionInfo?.reason}</p>
                </div>
                
                {!suspensionInfo?.isBlocked && suspensionInfo?.endDate && (
                     <div className="text-center">
                        <h4 className="font-semibold">Penangguhan Berakhir dalam:</h4>
                        <p className="text-primary font-semibold text-base">{countdown || 'Menghitung...'}</p>
                    </div>
                )}
                 <p className="text-xs text-muted-foreground pt-4">
                    Jika Anda merasa ini adalah sebuah kesalahan, silakan hubungi admin untuk bantuan lebih lanjut.
                </p>
            </div>
          <DialogFooter>
            <Button onClick={() => setSuspensionInfo(null)} className="w-full">Saya Mengerti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <LoginForm />
        </Suspense>
    )
}
