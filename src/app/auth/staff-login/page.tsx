
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
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase/client";

const staffLoginSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Kata sandi tidak boleh kosong."),
  accessCode: z.string().optional(),
});

type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

export default function StaffLoginPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAsAdmin, setLoginAsAdmin] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

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
    defaultValues: { email: "", password: "", accessCode: "" },
  });
  
  const onSubmit = async (data: StaffLoginFormValues) => {
    setIsSubmitting(true);
    
    // Admin login with access code
    if (loginAsAdmin) {
        if (data.accessCode === "Admin123") {
            localStorage.setItem('userRole', 'admin');
            toast({ title: "Berhasil", description: "Selamat datang, Admin!" });
            router.push("/admin");
        } else {
            toast({
                variant: "destructive",
                title: "Gagal Masuk",
                description: "Kode akses Admin tidak valid.",
            });
            setIsSubmitting(false);
        }
        return;
    }

    // Petugas login with email and password
    try {
        const staffQuery = query(collection(db, "staff"), where("email", "==", data.email));
        const staffSnapshot = await getDocs(staffQuery);

        if (staffSnapshot.empty) {
            throw new Error("Akun petugas tidak ditemukan.");
        }

        const staffData = staffSnapshot.docs[0].data();
        if (staffData.password !== data.password) {
            throw new Error("Kata sandi salah.");
        }

        localStorage.setItem('userRole', 'petugas');
        localStorage.setItem('staffInfo', JSON.stringify({ name: staffData.name, id: staffSnapshot.docs[0].id }));
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

  const renderAdminForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent>
          <FormField
            control={form.control}
            name="accessCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kode Akses Admin</FormLabel>
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
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Masuk sebagai Admin
            </Button>
            <Button variant="link" onClick={() => setLoginAsAdmin(false)}>Masuk sebagai Petugas</Button>
            <Link href="/" className="underline text-sm">Kembali ke Halaman Utama</Link>
        </CardFooter>
    </form>
  )

  const renderPetugasForm = () => (
     <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                  <FormLabel>Email Petugas</FormLabel>
                  <FormControl><Input placeholder="email@petugas.com" {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                  <FormLabel>Kata Sandi</FormLabel>
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
            <div className="text-center text-sm text-muted-foreground w-full flex justify-between">
                <Link href="/auth/staff-register" className="underline text-primary">Daftar Petugas</Link>
                <Link href="/auth/staff-forgot-password" className="underline">Lupa Sandi?</Link>
            </div>
            <hr className="w-full border-t" />
            <Button variant="link" onClick={() => setLoginAsAdmin(true)}>Masuk sebagai Admin</Button>
            <Link href="/" className="underline text-sm">Kembali ke Halaman Utama</Link>
        </CardFooter>
    </form>
  )


  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Akses Staf</CardTitle>
          <CardDescription>
             {loginAsAdmin ? "Masukkan kode akses super-admin." : "Masuk dengan akun petugas Anda."}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
            {loginAsAdmin ? renderAdminForm() : renderPetugasForm()}
        </Form>
      </Card>
    </>
  );
}
