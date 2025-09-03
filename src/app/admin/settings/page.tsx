
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
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Sun, Moon, Paintbrush, AlertTriangle, Upload, Copy, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from "@/lib/firebase/client";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const appNameSchema = z.object({ appName: z.string().min(1, "Nama aplikasi tidak boleh kosong.") });
const appLogoSchema = z.object({ appLogoUrl: z.string().url("URL logo tidak valid.").or(z.literal("")) });
const maintenanceSchema = z.object({ maintenanceMode: z.boolean() });
const appDownloadLinkSchema = z.object({ appDownloadLink: z.string().optional() });

type AppNameValues = z.infer<typeof appNameSchema>;
type AppLogoValues = z.infer<typeof appLogoSchema>;
type MaintenanceValues = z.infer<typeof maintenanceSchema>;

export default function AdminSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [appDownloadLink, setAppDownloadLink] = useState('');

  const appNameForm = useForm<AppNameValues>({ resolver: zodResolver(appNameSchema) });
  const appLogoForm = useForm<AppLogoValues>({ resolver: zodResolver(appLogoSchema) });
  const maintenanceForm = useForm<MaintenanceValues>({ resolver: zodResolver(maintenanceSchema) });

  useEffect(() => {
    const fetchSettings = async () => {
        setLoading(true);
        try {
            const settingsRef = doc(db, 'app_settings', 'config');
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                appNameForm.reset({ appName: data.appName || "Baronda" });
                appLogoForm.reset({ appLogoUrl: data.appLogoUrl || "https://iili.io/KJ4aGxp.png" });
                maintenanceForm.reset({ maintenanceMode: data.maintenanceMode || false });
                setAppDownloadLink(data.appDownloadLink || '');
            } else {
                 // Set default values if doc doesn't exist
                appNameForm.reset({ appName: "Baronda" });
                appLogoForm.reset({ appLogoUrl: "https://iili.io/KJ4aGxp.png" });
                maintenanceForm.reset({ maintenanceMode: false });
                setAppDownloadLink('');
            }
        } catch(error) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memuat pengaturan awal.'});
        } finally {
            setLoading(false);
        }
    };
    fetchSettings();
  }, [appNameForm, appLogoForm, maintenanceForm, toast]);
  
  const handleSave = async (field: keyof (AppNameValues & AppLogoValues & MaintenanceValues), data: any) => {
      setIsSubmitting(true);
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        await setDoc(settingsRef, { [field]: data[field] }, { merge: true });
        toast({ title: "Berhasil", description: "Pengaturan berhasil diperbarui." });
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan pengaturan." });
      } finally {
        setIsSubmitting(false);
      }
  }


  const handleApkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.apk')) {
        toast({ variant: 'destructive', title: 'File Tidak Valid', description: 'Silakan unggah file dengan format .apk' });
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const storage = getStorage();
    const storageRef = ref(storage, `release/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
        }, 
        (error) => {
            console.error("Upload error:", error);
            toast({ variant: 'destructive', title: 'Gagal Mengunggah', description: 'Terjadi kesalahan saat mengunggah file APK.' });
            setIsUploading(false);
            setUploadProgress(0);
        }, 
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const settingsRef = doc(db, 'app_settings', 'config');
            await setDoc(settingsRef, { appDownloadLink: downloadURL }, { merge: true });
            setAppDownloadLink(downloadURL);
            toast({ title: 'Unggah Berhasil', description: 'File APK berhasil diunggah dan tautan telah diperbarui.' });
            setIsUploading(false);
        }
    );
  };

  const copyToClipboard = () => {
    if (appDownloadLink) {
      navigator.clipboard.writeText(appDownloadLink);
      toast({ title: 'Tautan disalin!' });
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
        <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4"><Paintbrush className="h-5 w-5" />Tampilan Umum</h3>
            <div className="space-y-4">
                <Form {...appNameForm}>
                    <form onSubmit={appNameForm.handleSubmit((data) => handleSave('appName', data))} className="flex items-end gap-2">
                        <FormField
                        control={appNameForm.control}
                        name="appName"
                        render={({ field }) => (
                            <FormItem className="flex-grow">
                            <FormLabel>Judul Aplikasi</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g. Baronda App" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" size="sm" disabled={isSubmitting}><Pencil className="h-4 w-4" /></Button>
                    </form>
                </Form>

                <Form {...appLogoForm}>
                    <form onSubmit={appLogoForm.handleSubmit((data) => handleSave('appLogoUrl', data))} className="flex items-end gap-2">
                        <FormField
                        control={appLogoForm.control}
                        name="appLogoUrl"
                        render={({ field }) => (
                            <FormItem className="flex-grow">
                            <FormLabel>URL Logo Aplikasi</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="https://example.com/logo.png" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <Button type="submit" size="sm" disabled={isSubmitting}><Pencil className="h-4 w-4" /></Button>
                    </form>
                </Form>
            </div>
        </div>
        <Separator />
        
        <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4"><Download className="h-5 w-5" />File Aplikasi</h3>
             <FormItem>
                <FormLabel>File APK Aplikasi</FormLabel>
                 <div className="flex items-center gap-2">
                    <Input 
                        value={appDownloadLink || ''}
                        readOnly
                        placeholder="Tidak ada file APK yang diunggah"
                        className="bg-muted/50"
                    />
                     {appDownloadLink && (
                        <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                           <Copy className="h-4 w-4" />
                        </Button>
                     )}
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
                 {isUploading && (
                    <div className="mt-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(uploadProgress)}%</p>
                    </div>
                )}
                 <p className="text-sm text-muted-foreground">
                    Unggah file APK untuk disebarkan melalui halaman unduhan.
                </p>
             </FormItem>
        </div>

        <Separator />

        <div>
            <h3 className="text-lg font-medium flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Mode Pemeliharaan</h3>
            <p className="text-sm text-muted-foreground">
                Saat diaktifkan, hanya admin yang dapat mengakses aplikasi.
            </p>
        </div>
        <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit((data) => handleSave('maintenanceMode', data))}>
                <FormField
                control={maintenanceForm.control}
                name="maintenanceMode"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel className="text-base">
                        Aktifkan Mode Pemeliharaan
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                        Jika aktif, pengguna dan staf akan melihat halaman pemeliharaan.
                        </p>
                    </div>
                    <FormControl>
                        <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                            field.onChange(checked);
                            maintenanceForm.handleSubmit((data) => handleSave('maintenanceMode', data))();
                        }}
                        />
                    </FormControl>
                    </FormItem>
                )}
                />
            </form>
        </Form>
        
        <Separator />

        <div>
            <h3 className="text-lg font-medium mb-2">Tema Dasbor Admin</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Pilih antara mode terang atau gelap untuk dasbor Anda. Ini tidak akan memengaruhi tampilan pengguna.
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
