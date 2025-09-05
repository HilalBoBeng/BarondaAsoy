
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { sendOtp } from "@/ai/flows/send-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

const registerSchema = z.object({
    name: z.string().min(1, "Nama tidak boleh kosong.").max(35, "Nama tidak boleh lebih dari 35 karakter.").regex(/^[a-zA-Z .,-]+$/, "Nama hanya boleh berisi huruf, spasi, dan simbol .,-"),
    email: z.string().email("Format email tidak valid."),
    phone: z.string().min(1, "Nomor HP tidak boleh kosong."),
    addressType: z.enum(['kilongan', 'luar_kilongan'], { required_error: "Pilih jenis alamat." }),
    addressDetail: z.string().optional(),
    password: z.string().min(8, "Kata sandi minimal 8 karakter."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  }).refine((data) => {
    if (data.addressType === 'luar_kilongan') {
      return !!data.addressDetail && data.addressDetail.length > 0;
    }
    return true;
  }, {
    message: "Detail alamat harus diisi jika memilih 'Luar Kilongan'.",
    path: ["addressDetail"],
  });


type RegisterFormValues = z.infer<typeof registerSchema>;

export default function StaffRegisterPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", addressDetail: "", password: "", confirmPassword: "" },
  });
  
  const addressType = form.watch('addressType');

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
       // Check if email already exists in staff or users collection
      const staffQuery = query(collection(db, "staff"), where("email", "==", data.email));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        toast({ variant: "destructive", title: "Pendaftaran Gagal", description: "Email ini sudah terdaftar sebagai staf." });
        setIsSubmitting(false);
        return;
      }
      
      const result = await sendOtp({ email: data.email, context: 'staffRegistration' });

      if (!result.success) {
        throw new Error(result.message || 'Gagal mengirim OTP.');
      }
      
      toast({
        title: "Kode OTP Terkirim",
        description: `Kode verifikasi telah dikirim ke ${data.email}.`,
      });
      
      const registrationData = { 
        ...data, 
        name: toTitleCase(data.name),
        flow: 'staffRegistration',
        addressDetail: data.addressType === 'kilongan' ? 'Kilongan' : data.addressDetail,
      };

      localStorage.setItem('registrationData', JSON.stringify(registrationData));
      router.push('/auth/verify-otp');

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message || "Terjadi kesalahan saat pendaftaran.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Daftar Petugas</h1>
        <p className="text-sm text-muted-foreground">Isi formulir untuk menjadi bagian dari tim keamanan.</p>
      </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Nama Lengkap" {...field} maxLength={35} />
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
                    <FormControl>
                      <Input placeholder="Email" {...field} />
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
                    <FormControl>
                      <Input placeholder="Nomor HP" {...field} inputMode="numeric" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Pilih jenis alamat" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="kilongan">Warga Kilongan</SelectItem>
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
                        <FormControl>
                        <Textarea placeholder="Masukkan nama jalan, nomor rumah, RT/RW, dll." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              )}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="password" placeholder="Kata Sandi Akun (min. 8 karakter)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="password" placeholder="Konfirmasi Kata Sandi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Kirim Pendaftaran
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                  Sudah punya akun?{" "}
                  <Link
                      href="/auth/staff-login"
                      className="text-primary hover:text-primary/80 no-underline"
                  >
                      Masuk di sini
                  </Link>
              </div>
          </form>
        </Form>
    </>
  );
}
