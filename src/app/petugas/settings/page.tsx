
"use client";

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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AtSign, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Separator } from "@/components/ui/separator";
import { changeStaffEmail } from "@/ai/flows/change-staff-email";


const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini diperlukan."),
  newAccessCode: z.string().length(15, "Kode akses baru harus 15 karakter."),
  confirmNewAccessCode: z.string(),
}).refine(data => data.newAccessCode === data.confirmNewAccessCode, {
    message: "Konfirmasi kode akses baru tidak cocok.",
    path: ["confirmNewAccessCode"],
});

type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;

const emailSchema = z.object({
  newEmail: z.string().email("Format email tidak valid."),
  accessCode: z.string().min(1, "Kode akses diperlukan untuk verifikasi."),
});
type EmailFormValues = z.infer<typeof emailSchema>;


export default function StaffSettingsPage() {
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ id: string, name: string, email: string } | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id) {
      setStaffInfo(info);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Informasi petugas tidak ditemukan.' });
      router.push('/auth/staff-login');
    }
  }, [router, toast]);

  const accessCodeForm = useForm<AccessCodeFormValues>({
    resolver: zodResolver(accessCodeSchema),
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
    if (!staffInfo) return;
    setIsSubmittingCode(true);

    try {
        const staffRef = doc(db, 'staff', staffInfo.id);
        const staffDoc = await getDoc(staffRef);

        if (!staffDoc.exists() || staffDoc.data().accessCode !== data.currentAccessCode) {
            toast({ variant: "destructive", title: "Gagal", description: "Kode akses saat ini salah." });
            setIsSubmittingCode(false);
            return;
        }

        await updateDoc(staffRef, { accessCode: data.newAccessCode.toUpperCase() });
        toast({
            title: "Berhasil",
            description: "Kode akses Anda telah diubah. Silakan login kembali.",
        });
        accessCodeForm.reset();
        localStorage.removeItem('userRole');
        localStorage.removeItem('staffInfo');
        router.push('/auth/staff-login');
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Gagal",
            description: "Gagal mengubah kode akses.",
        });
    } finally {
        setIsSubmittingCode(false);
    }
  };
  
  const onEmailSubmit = async (data: EmailFormValues) => {
    if (!staffInfo) return;
    setIsSubmittingEmail(true);
    try {
        const result = await changeStaffEmail({
            staffId: staffInfo.id,
            newEmail: data.newEmail,
            accessCode: data.accessCode,
        });

        if (result.success) {
            localStorage.setItem('verificationContext', JSON.stringify({
                flow: 'changeStaffEmail',
                staffId: staffInfo.id,
                newEmail: data.newEmail,
                accessCode: data.accessCode 
            }));
            toast({ title: "Verifikasi Diperlukan", description: `Kode OTP telah dikirim ke ${data.newEmail}.` });
            router.push('/auth/verify-otp');
        } else {
            throw new Error(result.message);
        }

    } catch (error: any) {
      toast({ variant: 'destructive', title: "Gagal", description: error.message || "Kode akses salah atau terjadi kesalahan." });
    } finally {
      setIsSubmittingEmail(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Akun Petugas</CardTitle>
          <CardDescription>
            Ubah kode akses atau informasi akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Form {...accessCodeForm}>
            <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="max-w-md space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5" /> Ubah Kode Akses</h3>
              <FormField
                control={accessCodeForm.control}
                name="currentAccessCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Akses Saat Ini</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accessCodeForm.control}
                name="newAccessCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Akses Baru (15 Karakter)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accessCodeForm.control}
                name="confirmNewAccessCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Kode Akses Baru</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmittingCode || !staffInfo}>
                {isSubmittingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Kode Akses Baru
              </Button>
            </form>
          </Form>

          <Separator className="my-8" />
            
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="max-w-md space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2"><AtSign className="h-5 w-5" /> Ubah Email</h3>
                 <FormField
                    control={emailForm.control}
                    name="newEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Baru</FormLabel>
                            <FormControl><Input type="email" placeholder="email.baru@contoh.com" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={emailForm.control}
                    name="accessCode"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Verifikasi Kode Akses Saat Ini</FormLabel>
                            <FormControl><Input type="password" placeholder="Masukkan kode akses Anda" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isSubmittingEmail || !staffInfo}>
                    {isSubmittingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lanjutkan ke Verifikasi
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
