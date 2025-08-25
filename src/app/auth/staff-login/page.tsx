
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

const staffLoginSchema = z.object({
  accessCode: z.string().min(1, "Kode akses tidak boleh kosong."),
});

type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

export default function StaffLoginPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    
    // Simulate checking the access code
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (data.accessCode === "Admin123") {
      localStorage.setItem('userRole', 'admin');
      toast({ title: "Berhasil", description: "Selamat datang, Admin!" });
      router.push("/admin");
    } else if (data.accessCode === "Petugas123") {
      localStorage.setItem('userRole', 'petugas');
      toast({ title: "Berhasil", description: "Selamat datang, Petugas!" });
      router.push("/petugas");
    } else {
      localStorage.removeItem('userRole');
      toast({
        variant: "destructive",
        title: "Gagal Masuk",
        description: "Kode akses tidak valid.",
      });
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
          <CardTitle>Masuk Staf</CardTitle>
          <CardDescription>
            Masukkan kode akses Anda untuk melanjutkan.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="accessCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Akses</FormLabel>
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
                Masuk
              </Button>
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
