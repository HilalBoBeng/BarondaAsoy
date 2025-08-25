
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
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Separator } from "@/components/ui/separator";

const accessCodeSchema = z.object({
  newAccessCode: z.string().length(15, "Kode akses baru harus 15 karakter."),
});

type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;

export default function StaffSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.id) {
      setStaffId(staffInfo.id);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Informasi petugas tidak ditemukan.' });
      router.push('/auth/staff-login');
    }
  }, [router, toast]);


  const accessCodeForm = useForm<AccessCodeFormValues>({
    resolver: zodResolver(accessCodeSchema),
  });

  const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
    if (!staffId) return;
    setIsSubmitting(true);
    try {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, { accessCode: data.newAccessCode.toUpperCase() });
      toast({
        title: "Berhasil",
        description: "Kode akses Anda telah diubah. Silakan login kembali.",
      });
      accessCodeForm.reset();
      // Log out to force re-login with the new code
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
      setIsSubmitting(false);
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
        <CardContent>
          <Form {...accessCodeForm}>
            <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="max-w-md space-y-6">
              <h3 className="text-lg font-medium">Ubah Kode Akses</h3>
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
              <Button type="submit" disabled={isSubmitting || !staffId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Kode Akses Baru
              </Button>
            </form>
          </Form>

          <Separator className="my-8" />
            
          <div>
             <h3 className="text-lg font-medium">Ubah Email</h3>
             <p className="text-sm text-muted-foreground mt-2">
                Untuk mengubah email Anda, silakan hubungi admin untuk bantuan lebih lanjut.
             </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
