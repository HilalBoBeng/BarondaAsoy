
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
import { Loader2, KeyRound, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { addDays, isBefore, formatDistanceToNow, subDays } from 'date-fns';
import { id } from 'date-fns/locale';

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini diperlukan."),
  newAccessCode: z.string().min(1, "Kode akses baru tidak boleh kosong."),
  confirmNewAccessCode: z.string(),
}).refine(data => data.newAccessCode === data.confirmNewAccessCode, {
    message: "Konfirmasi kode akses baru tidak cocok.",
    path: ["confirmNewAccessCode"],
});

type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;


export default function StaffSettingsPage() {
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ id: string, name: string, email: string } | null>(null);
  const [lastCodeChange, setLastCodeChange] = useState<Date | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id) {
      setStaffInfo(info);
      const staffRef = doc(db, 'staff', info.id);
      getDoc(staffRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.lastCodeChangeTimestamp) {
            setLastCodeChange((data.lastCodeChangeTimestamp as Timestamp).toDate());
          }
        }
      });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Informasi petugas tidak ditemukan.' });
      router.push('/auth/staff-login');
    }
  }, [router, toast]);

  const canChangeCode = !lastCodeChange || isBefore(lastCodeChange, subDays(new Date(), 7));

  const accessCodeForm = useForm<AccessCodeFormValues>({
    resolver: zodResolver(accessCodeSchema),
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

        await updateDoc(staffRef, { 
            accessCode: data.newAccessCode,
            lastCodeChangeTimestamp: serverTimestamp(),
        });

        toast({
            title: "Berhasil",
            description: "Kode akses Anda telah diubah.",
        });
        
        // Fetch the new timestamp to update the state accurately
        const updatedStaffDoc = await getDoc(staffRef);
        if (updatedStaffDoc.exists() && updatedStaffDoc.data().lastCodeChangeTimestamp) {
          setLastCodeChange((updatedStaffDoc.data().lastCodeChangeTimestamp as Timestamp).toDate());
        }
        
        accessCodeForm.reset();
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
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan</CardTitle>
        <CardDescription>
          Kelola pengaturan akun Anda dan tampilan aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Change Access Code Form */}
        <Form {...accessCodeForm}>
          <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="max-w-md space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5" /> Ubah Kode Akses</h3>
            
            {canChangeCode ? (
              <>
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
                      <FormLabel>Kode Akses Baru</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
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
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmittingCode || !staffInfo}>
                  {isSubmittingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Kode Akses Baru
                </Button>
              </>
            ) : (
              <>
                 <FormField
                    control={accessCodeForm.control}
                    name="currentAccessCode"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Kode Akses Saat Ini</FormLabel>
                        <FormControl>
                            <Input type="password" {...field} readOnly value="********" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <p className="text-sm text-muted-foreground">
                    Anda baru bisa mengubah kode akses lagi {lastCodeChange ? formatDistanceToNow(addDays(lastCodeChange, 7), { addSuffix: true, locale: id }) : 'dalam 7 hari'}.
                </p>
              </>
            )}
          </form>
        </Form>
        
        <Separator />
        
        {/* Display Settings */}
        <div>
          <h3 className="text-lg font-medium mb-2">Pengaturan Tampilan</h3>
          <p className="text-sm text-muted-foreground mb-4">
              Pilih tema tampilan untuk aplikasi.
          </p>
          <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                  <h3 className="font-medium">Tema Aplikasi</h3>
                  <p className="text-sm text-muted-foreground">
                      Pilih antara mode terang atau gelap.
                  </p>
              </div>
              <div className="flex items-center gap-2">
                  <Button variant={theme === 'light' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("light")}>
                      <Sun className="h-5 w-5" />
                      <span className="sr-only">Light</span>
                  </Button>
                  <Button variant={theme === 'dark' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("dark")}>
                      <Moon className="h-5 w-5" />
                      <span className="sr-only">Dark</span>
                  </Button>
              </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
