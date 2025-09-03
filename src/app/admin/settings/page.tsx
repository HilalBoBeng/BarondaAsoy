
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Sun, Moon, Paintbrush, AlertTriangle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from "@/lib/firebase/client";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";

const settingsSchema = z.object({
  appName: z.string().min(1, "Nama aplikasi tidak boleh kosong."),
  appLogoUrl: z.string().url("URL logo tidak valid.").or(z.literal("")),
  appDownloadLink: z.string().url("URL tidak valid.").optional().or(z.literal('')),
  maintenanceMode: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function AdminSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      appName: "Baronda",
      appLogoUrl: "https://iili.io/KJ4aGxp.png",
      appDownloadLink: "",
      maintenanceMode: false,
    },
  });
  
  useEffect(() => {
    const fetchSettings = async () => {
        setLoading(true);
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            form.reset(docSnap.data() as SettingsFormValues);
        }
        setLoading(false);
    };
    fetchSettings();
  }, [form]);

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSubmitting(true);
    try {
        const settingsRef = doc(db, 'app_settings', 'config');
        await setDoc(settingsRef, data, { merge: true });
        toast({
            title: "Berhasil",
            description: "Pengaturan tampilan berhasil disimpan.",
        });
    } catch (error) {
         toast({
            variant: "destructive",
            title: "Gagal",
            description: "Gagal menyimpan pengaturan.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleApkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.name.endsWith('.apk')) {
        toast({ variant: 'destructive', title: 'File Tidak Valid', description: 'Silakan unggah file dengan format .apk' });
        return;
    }

    setIsUploading(true);
    try {
        const storage = getStorage();
        const storageRef = ref(storage, `release/${file.name}`);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        const settingsRef = doc(db, 'app_settings', 'config');
        await updateDoc(settingsRef, { appDownloadLink: downloadURL });
        
        form.setValue('appDownloadLink', downloadURL);

        toast({ title: 'Unggah Berhasil', description: 'File APK berhasil diunggah dan tautan telah diperbarui.' });
    } catch (error) {
        console.error("Upload error:", error);
        toast({ variant: 'destructive', title: 'Gagal Mengunggah', description: 'Terjadi kesalahan saat mengunggah file APK.' });
    } finally {
        setIsUploading(false);
    }
  };

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-8">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atur Tampilan & Sistem</CardTitle>
        <CardDescription>
          Kelola tampilan umum aplikasi dan status sistem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
                <h3 className="text-lg font-medium flex items-center gap-2"><Paintbrush className="h-5 w-5" />Tampilan Umum</h3>
                <p className="text-sm text-muted-foreground">
                   Ubah judul dan logo yang muncul di seluruh aplikasi.
                </p>
            </div>
             <FormField
              control={form.control}
              name="appName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Judul Aplikasi</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Baronda App" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="appLogoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Logo Aplikasi</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com/logo.png" />
                  </FormControl>
                   <FormDescription>
                    Pastikan URL gambar dapat diakses secara publik.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormItem>
                <FormLabel>File APK Aplikasi</FormLabel>
                <div className="flex items-center gap-4">
                    <Input 
                        value={form.watch('appDownloadLink') || ''}
                        readOnly
                        placeholder="Tidak ada file APK yang diunggah"
                    />
                    <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Unggah
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".apk"
                        onChange={handleApkUpload}
                    />
                </div>
                <FormDescription>
                    Unggah file APK untuk disebarkan melalui halaman unduhan.
                </FormDescription>
             </FormItem>

             <Separator />

            <div>
                <h3 className="text-lg font-medium flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Mode Pemeliharaan</h3>
                 <p className="text-sm text-muted-foreground">
                   Saat diaktifkan, hanya admin yang dapat mengakses aplikasi.
                </p>
            </div>
             <FormField
              control={form.control}
              name="maintenanceMode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Aktifkan Mode Pemeliharaan
                    </FormLabel>
                    <FormDescription>
                      Jika aktif, pengguna dan staf akan melihat halaman pemeliharaan.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <Button type="submit" disabled={isSubmitting || loading || isUploading}>
                {(isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
            </Button>
          </form>
        </Form>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Tema Aplikasi</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Pilih antara mode terang atau gelap untuk dasbor Anda.
            </p>
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <h3 className="font-medium">Tema Tampilan</h3>
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
