
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
  CardFooter,
  CardHeader,
  CardTitle,
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
  const [showResetPasswordAlert, setShowResetPasswordAlert] = useState(false);
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
      setShowResetPasswordAlert(true);
      form.setValue('email', emailForReset);
    }

  }, [searchParams, form]);

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
                setSuspensionInfo({ user: fullUserData, reason: userData.suspensionReason || 'Akun Anda telah diblokir oleh admin.', endDate: null, isBlocked: true });
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
        router.push("/");
    } catch (error) {
       const currentAttempts = (loginAttempts[data.email] || 0) + 1;
       setLoginAttempts(prev => ({...prev, [data.email]: currentAttempts}));

       if (currentAttempts >= 3) {
            toast({
                variant: "destructive",
                title: "Terlalu Banyak Percobaan Login",
                description: "Anda akan dialihkan untuk mengatur ulang kata sandi.",
            });
            router.push(`/auth/forgot-password?email=${encodeURIComponent(data.email)}&resetAlert=true`);
       } else {
            toast({
                variant: "destructive",
                title: "Login Gagal",
                description: `Email atau kata sandi salah. Percobaan ke-${currentAttempts} dari 3.`,
            });
       }
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
       {showSuccessMessage && (
        <Alert className="mb-4 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 [&>svg]:text-green-600 animate-fade-in">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Registrasi Berhasil!</AlertTitle>
            <AlertDescription>
            Akun Anda telah berhasil dibuat. Silakan masuk.
            </AlertDescription>
        </Alert>
      )}
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
          <CardTitle>Masuk Akun</CardTitle>
          <CardDescription>
            Masukkan email dan kata sandi Anda untuk melanjutkan.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                     <div className="flex items-center">
                      <FormLabel>Kata Sandi</FormLabel>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                     <div className="text-right mt-2">
                      <Link
                        href="/auth/forgot-password"
                        className="ml-auto inline-block text-xs text-primary hover:text-primary/80"
                      >
                        Lupa kata sandi?
                      </Link>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Masuk
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                  Belum punya akun?{" "}
                  <Link
                      href="/auth/register"
                      className="text-primary hover:text-primary/80"
                  >
                      Daftar di sini
                  </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Dialog open={!!suspensionInfo} onOpenChange={() => setSuspensionInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-destructive flex items-center gap-2">
                <ShieldAlert className="h-7 w-7" />
                Akun {suspensionInfo?.isBlocked ? 'Diblokir' : 'Ditangguhkan'}
            </DialogTitle>
             <DialogDescription>
                Akses Anda ke aplikasi telah {suspensionInfo?.isBlocked ? 'diblokir' : 'ditangguhkan sementara'} oleh admin.
            </DialogDescription>
          </DialogHeader>
           <div className="space-y-4 py-4 text-sm">
                <div className="space-y-2 rounded-md border p-4">
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

                <div>
                    <h4 className="font-semibold">Alasan:</h4>
                    <p className="text-destructive font-bold">{suspensionInfo?.reason}</p>
                </div>
                
                {!suspensionInfo?.isBlocked && suspensionInfo?.endDate && (
                     <div>
                        <h4 className="font-semibold">Penangguhan Berakhir:</h4>
                        <p className="text-primary font-mono font-semibold text-lg">{countdown || 'Menghitung...'}</p>
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
