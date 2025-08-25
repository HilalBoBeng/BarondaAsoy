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
import { sendOtp } from "@/ai/flows/send-otp";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";


const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await sendOtp({ email: data.email });
      if (result.success) {
        toast({
          title: "Berhasil",
          description: "Kode OTP telah dikirim ke email Anda.",
        });
        // Store email and redirect to OTP verification page
        localStorage.setItem('verificationContext', JSON.stringify({ email: data.email, flow: 'resetPassword' }));
        router.push('/auth/verify-otp');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Gagal Mengirim OTP",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-center mb-6">
          <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={80} height={80} className="h-20 w-auto" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lupa Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan email Anda untuk menerima kode OTP untuk mengatur ulang kata sandi.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
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
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                 {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Kirim Kode OTP
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/login" className="underline">
                  Kembali ke Halaman Masuk
                </Link>
              </div>
              <div className="text-center text-sm">
                  <Link href="/" className="underline">
                      Kembali ke Halaman Utama
                  </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
