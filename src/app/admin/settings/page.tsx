
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
import { Loader2, Moon, Sun, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { addDays, isBefore, subDays } from 'date-fns';
import { Timestamp } from "firebase/firestore";

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
  const [lastPasswordChange, setLastPasswordChange] = useState<Date | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  // This is a simulation. In a real app, you'd fetch this from the database.
  useEffect(() => {
    const lastChangeStr = localStorage.getItem('adminPasswordLastChange');
    if (lastChangeStr) {
      setLastPasswordChange(new Date(lastChangeStr));
    }
  }, []);

  const canChangePassword = !lastPasswordChange || isBefore(lastPasswordChange, subDays(new Date(), 7));

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    }
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    // This is a simulation. In a real app, you'd call a backend function.
    if (data.currentPassword === "Admin123") {
      // In a real app, you would update the password in your database.
      // For this simulation, we'll just show success and update the UI state.
      console.log("Admin password changed to:", data.newPassword);
      toast({
        title: "Berhasil",
        description: "Kata sandi admin berhasil diubah (simulasi).",
      });
      const now = new Date();
      setLastPasswordChange(now);
      localStorage.setItem('adminPasswordLastChange', now.toISOString());
      form.reset();
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
        <CardTitle>Pengaturan</CardTitle>
        <CardDescription>
          Kelola pengaturan untuk akun super-admin dan tampilan aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
                <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5" />Ubah Kata Sandi Admin</h3>
                <p className="text-sm text-muted-foreground">
                    Kata sandi admin default adalah `Admin123`. Demi keamanan, ubah kata sandi ini segera.
                </p>
            </div>
            {canChangePassword ? (
                <>
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
                </>
            ) : (
                <>
                    <FormField
                        control={form.control}
                        name="currentPassword"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Kata Sandi Saat Ini</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} readOnly value={'********'} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <p className="text-sm text-muted-foreground">
                        Anda baru bisa mengubah kata sandi lagi {lastPasswordChange ? formatDistanceToNow(addDays(lastPasswordChange, 7), { addSuffix: true, locale: id }) : 'dalam 7 hari'}.
                    </p>
                </>
            )}
          </form>
        </Form>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Pengaturan Tampilan</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Pilih tema tampilan untuk aplikasi.
            </p>
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <h3 className="font-medium">Tema Aplikasi</h3>
                    <p className="text-sm text-muted-foreground">
                        Pilih antara mode terang atau gelap.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={theme === 'light' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("light")}>
                        <Sun className="h-5 w-5" />
                        <span className="sr-only">Light</span>
                    </Button>
                    <Button variant={theme === 'dark' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("dark")}>
                        <Moon className="h-5 w-5" />
                        <span className="sr-only">Dark</span>
                    </Button>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
