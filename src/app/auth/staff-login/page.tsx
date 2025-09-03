
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";


const staffLoginSchema = z.object({
  accessCode: z.string().min(1, "Kode akses tidak boleh kosong."),
});

type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

export default function StaffLoginPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<{ reason: string; endDate: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      router.replace('/admin');
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
    }
  }, [router]);

  const form = useForm<StaffLoginFormValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { accessCode: "" },
  });
  
  const onSubmit = async (data: StaffLoginFormValues) => {
    setIsSubmitting(true);
    setSuspensionInfo(null);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Admin login check
    if (data.accessCode === "Admin123") {
        localStorage.setItem('userRole', 'admin');
        const adminInfo = { name: "Admin Utama", email: "admin@baronda.app" };
        localStorage.setItem('staffInfo', JSON.stringify(adminInfo));
        toast({ title: "Berhasil", description: "Selamat datang, Admin!" });
        router.push("/admin");
        setIsSubmitting(false);
        return;
    }

    // Petugas login check
    try {
        const staffQuery = query(
            collection(db, "staff"), 
            where("accessCode", "==", data.accessCode)
        );
        const staffSnapshot = await getDocs(staffQuery);

        if (staffSnapshot.empty) {
            throw new Error("Kode akses salah atau akun Anda tidak aktif/tertunda.");
        }
        
        const staffDoc = staffSnapshot.docs[0];
        const staffData = staffDoc.data();
        
        if (staffData.status === 'pending') {
             throw new Error("Akun Anda masih menunggu persetujuan dari admin.");
        }
        
        if (staffData.status === 'suspended') {
            const endDate = staffData.suspensionEndDate ? (staffData.suspensionEndDate as Timestamp).toDate() : null;
            const endDateString = endDate ? formatDistanceToNow(endDate, { addSuffix: true, locale: id }) : 'permanen';
            setSuspensionInfo({ reason: staffData.suspensionReason || 'Tidak ada alasan yang diberikan.', endDate: endDateString });
            setIsSubmitting(false);
            return;
        }
        
        if (staffData.status !== 'active') {
             throw new Error("Akun Anda tidak aktif.");
        }


        localStorage.setItem('userRole', 'petugas');
        localStorage.setItem('staffInfo', JSON.stringify({ name: staffData.name, id: staffDoc.id, email: staffData.email }));
        toast({ title: "Berhasil", description: `Selamat datang, ${staffData.name}!` });
        router.push("/petugas");

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
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Akses Staf & Admin</CardTitle>
          <CardDescription>
             Masuk dengan kode akses unik Anda.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                <FormField control={form.control} name="accessCode" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Kode Akses</FormLabel>
                        <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Masuk
                    </Button>
                    <div className="text-center text-sm text-muted-foreground w-full flex flex-col sm:flex-row justify-center items-center gap-2">
                        <Link href="/auth/staff-register" className="text-primary hover:text-primary/80">
                            Daftar sebagai Petugas
                        </Link>
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <Link href="/auth/staff-forgot-password" className="text-primary hover:text-primary/80">
                            Lupa Kode Akses?
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Form>
      </Card>

      <Dialog open={!!suspensionInfo} onOpenChange={() => setSuspensionInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Akun Ditangguhkan</DialogTitle>
            <DialogDescription>
              {suspensionInfo?.reason}
            </DialogDescription>
          </DialogHeader>
           {suspensionInfo?.endDate !== 'permanen' && (
             <div className="text-sm text-center text-muted-foreground">
                Penangguhan berakhir {suspensionInfo?.endDate}.
            </div>
           )}
          <DialogFooter>
            <Button onClick={() => setSuspensionInfo(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
