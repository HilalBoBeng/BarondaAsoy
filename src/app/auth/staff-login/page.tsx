
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, ShieldAlert, User, Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { formatDistanceToNow, intervalToDuration } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Staff } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const staffLoginSchema = z.object({
  accessCode: z.string().min(1, "Kode akses tidak boleh kosong."),
});

type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

type SuspensionInfo = {
    user: Staff;
    reason: string;
    endDate: Date | null;
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

export default function StaffLoginPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [countdown, setCountdown] = useState('');
  const router = useRouter();
  const [loginAwaitingConfirmation, setLoginAwaitingConfirmation] = useState(false);
  const [staffDocForConfirmation, setStaffDocForConfirmation] = useState<any>(null);
  let unsub: any = null;

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin' || userRole === 'bendahara') {
      router.replace('/admin');
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
    }
  }, [router]);
  
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
    if (staffDocForConfirmation) {
      unsub = onSnapshot(doc(db, 'staff', staffDocForConfirmation.id), (docSnap) => {
        const staffData = docSnap.data() as Staff;
        const localSessionId = localStorage.getItem('pendingSessionId');

        if (staffData.activeSessionId === localSessionId) {
          // Login approved
          handleSuccessfulLogin(staffData);
          setLoginAwaitingConfirmation(false);
          if (unsub) unsub();
        } else if (!staffData.loginRequest) {
          // Login denied or timed out
          toast({ variant: "destructive", title: "Gagal Masuk", description: "Permintaan masuk Anda ditolak atau telah kedaluwarsa." });
          setLoginAwaitingConfirmation(false);
          if (unsub) unsub();
        }
      });
    }
    return () => {
      if (unsub) unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffDocForConfirmation]);


  const form = useForm<StaffLoginFormValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { accessCode: "" },
  });
  
  const handleSuccessfulLogin = (staffData: Staff) => {
    const role = staffData.role || 'petugas';
    localStorage.setItem('userRole', role);
    localStorage.setItem('staffInfo', JSON.stringify({ name: staffData.name, id: staffData.id, email: staffData.email, role: role }));
    localStorage.setItem('activeSessionId', staffData.activeSessionId!);
    localStorage.removeItem('pendingSessionId');

    toast({ title: "Berhasil", description: `Selamat datang, ${staffData.name}!` });
    if (role === 'admin' || role === 'bendahara') {
        router.push("/admin");
    } else {
        router.push("/petugas");
    }
  }

  const onSubmit = async (data: StaffLoginFormValues) => {
    setIsSubmitting(true);
    setSuspensionInfo(null);

    try {
        const staffQuery = query(
            collection(db, "staff"), 
            where("accessCode", "==", data.accessCode),
            where("status", "in", ["active", "suspended"])
        );
        const staffSnapshot = await getDocs(staffQuery);

        if (staffSnapshot.empty) {
            throw new Error("Kode akses salah atau akun Anda tidak aktif/tertunda.");
        }
        
        const staffDoc = staffSnapshot.docs[0];
        const staffData = {id: staffDoc.id, ...staffDoc.data()} as Staff;
        
        if (staffData.status === 'suspended') {
            const endDate = staffData.suspensionEndDate ? (staffData.suspensionEndDate as Timestamp).toDate() : null;
            setSuspensionInfo({ user: staffData, reason: staffData.suspensionReason || 'Tidak ada alasan yang diberikan.', endDate });
            setIsSubmitting(false);
            return;
        }

        const newSessionId = Math.random().toString(36).substring(2, 15);

        if (staffData.activeSessionId) {
            // Another device is logged in, request permission
            localStorage.setItem('pendingSessionId', newSessionId);
            setStaffDocForConfirmation({ id: staffDoc.id });
            await updateDoc(staffDoc.ref, {
              loginRequest: {
                sessionId: newSessionId,
                timestamp: serverTimestamp()
              }
            });
            setLoginAwaitingConfirmation(true);
        } else {
            // No other device is logged in, proceed
            await updateDoc(staffDoc.ref, {
              activeSessionId: newSessionId,
              loginRequest: null
            });
            handleSuccessfulLogin({ ...staffData, activeSessionId: newSessionId });
        }

    } catch (error) {
        localStorage.removeItem('userRole');
        toast({
            variant: "destructive",
            title: "Gagal Masuk",
            description: error instanceof Error ? error.message : "Terjadi kesalahan.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto mb-4" />
        <h1 className="text-2xl font-bold">Akses Staf & Admin</h1>
        <p className="text-sm text-muted-foreground">Masuk dengan kode akses unik Anda.</p>
      </div>

       {loginAwaitingConfirmation && (
         <Alert className="mt-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Menunggu Persetujuan</AlertTitle>
            <AlertDescription>
                Akun ini sedang digunakan di perangkat lain. Silakan tunggu persetujuan dari perangkat tersebut untuk masuk.
            </AlertDescription>
        </Alert>
       )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField control={form.control} name="accessCode" render={({ field }) => (
                <FormItem>
                    <FormControl>
                        <Input type="password" placeholder="Kode Akses" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <div className="text-right">
                <Button asChild variant="link" size="sm" className="px-0">
                    <Link href="/auth/staff-forgot-password">Lupa kode akses?</Link>
                </Button>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || loginAwaitingConfirmation}>
                {isSubmitting || loginAwaitingConfirmation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loginAwaitingConfirmation ? 'Menunggu...' : 'Masuk'}
            </Button>
        </form>
      </Form>
      
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Bukan staf?{" "}
        <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 no-underline">
            Masuk sebagai warga
        </Link>
      </div>

      <Dialog open={!!suspensionInfo} onOpenChange={() => setSuspensionInfo(null)}>
        <DialogContent className="sm:max-w-md text-center">
           <DialogHeader className="items-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                    <ShieldAlert className="h-7 w-7 text-destructive" />
                </div>
                <DialogTitle className="text-2xl text-foreground">
                    Akun Ditangguhkan
                </DialogTitle>
                <DialogDescription className="text-center px-4">
                    Akses Anda ke aplikasi telah ditangguhkan sementara oleh admin.
                </DialogDescription>
            </DialogHeader>
             <div className="space-y-4 py-4 text-sm">
                <div className="space-y-2 rounded-md border p-4 text-left">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{suspensionInfo?.user.name}</span>
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
                
                {suspensionInfo?.endDate && (
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
