
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const staffRegisterSchema = z
  .object({
    name: z.string().min(1, "Nama tidak boleh kosong."),
    email: z.string().email("Format email tidak valid."),
    phone: z.string().min(1, "Nomor HP tidak boleh kosong."),
    addressType: z.enum(['kilongan', 'luar_kilongan'], { required_error: "Pilih jenis alamat." }),
    addressDetail: z.string().optional(),
  })
  .refine((data) => {
    if (data.addressType === 'luar_kilongan') {
      return !!data.addressDetail && data.addressDetail.length > 0;
    }
    return true;
  }, {
    message: "Detail alamat harus diisi jika memilih 'Luar Kilongan'.",
    path: ["addressDetail"],
  });


type StaffRegisterFormValues = z.infer<typeof staffRegisterSchema>;

export default function StaffRegisterPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const form = useForm<StaffRegisterFormValues>({
    resolver: zodResolver(staffRegisterSchema),
    defaultValues: { name: "", email: "", phone: "", addressDetail: "" },
  });
  
  const addressType = form.watch('addressType');

 const onSubmit = async (data: StaffRegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const staffData = {
        ...data,
        addressDetail: data.addressType === 'kilongan' ? 'KILONGAN' : data.addressDetail,
        status: 'pending' as 'pending' | 'active' | 'rejected',
        accessCode: accessCode,
      };

      await addDoc(collection(db, 'staff'), staffData);
      
      toast({
        title: "Pendaftaran Terkirim",
        description: "Pendaftaran Anda telah berhasil dikirim dan menunggu persetujuan admin.",
      });
      router.push('/auth/staff-login');

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
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
          <CardTitle>Daftar Akun Petugas</CardTitle>
          <CardDescription>
            Isi formulir di bawah ini untuk mendaftar. Pendaftaran Anda akan ditinjau oleh Admin.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama Anda" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor HP</FormLabel>
                    <FormControl>
                      <Input placeholder="08xxxxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Pilih jenis alamat" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="kilongan">Warga Kel. Kilongan</SelectItem>
                            <SelectItem value="luar_kilongan">Warga Luar Kilongan</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {addressType === 'luar_kilongan' && (
                  <FormField
                    control={form.control}
                    name="addressDetail"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Detail Alamat</FormLabel>
                        <FormControl>
                        <Textarea placeholder="Masukkan nama jalan, nomor rumah, RT/RW, dll." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              )}
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Daftar
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                  Sudah punya akun petugas?{" "}
                  <Link
                      href="/auth/staff-login"
                      className="inline-flex items-center gap-1 underline text-primary"
                  >
                      <LogIn className="h-4 w-4" />
                      Masuk di sini
                  </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
