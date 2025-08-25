
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini diperlukan."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi kata sandi baru tidak cocok.",
    path: ["confirmNewPassword"],
});


type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AdminSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    // This is a simplified logic. In a real app, you would validate the current password
    // against a stored value and then update it. For now, we assume the default admin password.
    // In a real app, you'd use a secure backend flow to change this.
    if (data.currentPassword === "Admin123") {
      console.log("Admin password changed to:", data.newPassword);
      toast({
        title: "Berhasil",
        description: "Kata sandi admin berhasil diubah (simulasi). Anda akan dikeluarkan.",
      });
      // For security, log out the admin to force re-login with the new password.
      localStorage.removeItem('userRole');
      localStorage.removeItem('staffInfo');
      router.push('/auth/staff-login');
    } else {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Kata sandi saat ini salah.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Akun Admin</CardTitle>
        <CardDescription>
          Kelola pengaturan untuk akun super-admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-6">
            <h3 className="text-lg font-medium">Ubah Kata Sandi Admin</h3>
            <p className="text-sm text-muted-foreground">
                Kata sandi admin saat ini adalah `Admin123`. Demi keamanan, ubah kata sandi ini segera.
            </p>
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kata Sandi Saat Ini</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kata Sandi Baru</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Konfirmasi Kata Sandi Baru</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
