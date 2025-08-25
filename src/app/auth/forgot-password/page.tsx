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

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: ForgotPasswordFormValues) => {
    console.log("OTP requested for password reset:", data);
    // TODO: Implement Firebase password reset logic with OTP via email
  };

  return (
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
            <Button type="submit" className="w-full">
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
  );
}
