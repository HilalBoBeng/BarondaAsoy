
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
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAuth, fetchSignInMethodsForEmail } from "firebase/auth";
import { app } from "@/lib/firebase/client";
import { sendOtp } from "@/ai/flows/send-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

const registerSchema = z.object({
    name: z.string().min(1, "Nama tidak boleh kosong.").max(25, "Nama tidak boleh lebih dari 25 karakter.").regex(/^[a-zA-Z .,-]+$/, "Nama hanya boleh berisi huruf, spasi, dan simbol .,-"),
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

export default function RegisterPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", addressDetail: "", password: "", confirmPassword: "" },
  });
  
  const addressType = form.watch('addressType');

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      // Check if email already exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, data.email);
      if (signInMethods.length > 0) {
        toast({
          variant: "destructive",
          title: "Pendaftaran Gagal",
          description: "Email ini sudah terdaftar. Silakan gunakan email lain atau masuk.",
        });
        setIsSubmitting(false);
        return;
      }
      
      const result = await sendOtp({ email: data.email, context: 'userRegistration' });

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
        flow: 'userRegistration',
        addressDetail: data.addressType === 'kilongan' ? 'Kilongan' : data.addressDetail,
      };

      // Store form data to be used after OTP verification
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
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Akun Baru</CardTitle>
          <CardDescription>
            Buat akun untuk mulai menggunakan aplikasi. Kami akan mengirimkan kode verifikasi ke email Anda.
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
                      <Input placeholder="Nama Anda" {...field} maxLength={25} />
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
                      <Input placeholder="08xxxxxxxxxx" {...field} inputMode="numeric" />
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
                            <SelectItem value="kilongan">Kilongan</SelectItem>
                            <SelectItem value="luar_kilongan">Luar Kilongan</SelectItem>
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
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
                    <FormLabel>Konfirmasi Kata Sandi</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Daftar
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                  Sudah punya akun?{" "}
                  <Link
                      href="/auth/login"
                      className="text-primary hover:underline"
                  >
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
