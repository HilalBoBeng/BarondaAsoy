
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Copy, Loader2, Save } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Schema for the form
const settingsSchema = z.object({
  appName: z.string().min(1, "Nama aplikasi tidak boleh kosong."),
  appLogoUrl: z.string().url("URL logo tidak valid."),
  appDownloadLink: z.string().optional(),
  maintenanceMode: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      appName: '',
      appLogoUrl: '',
      appDownloadLink: '',
      maintenanceMode: false,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          form.reset(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat memuat pengaturan.' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  const handleGenericSubmit = async (field: keyof SettingsFormValues, value: any) => {
    setIsSubmitting(prev => ({ ...prev, [field]: true }));
    try {
      const settingsRef = doc(db, 'app_settings', 'config');
      await updateDoc(settingsRef, { [field]: value });
      toast({ title: 'Berhasil', description: `Pengaturan ${field} berhasil diperbarui.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyimpan pengaturan.' });
    } finally {
      setIsSubmitting(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleApkUpload = () => {
    if (!apkFile) {
      toast({ variant: 'destructive', title: 'Tidak Ada File', description: 'Silakan pilih file APK terlebih dahulu.' });
      return;
    }

    const storage = getStorage();
    const storageRef = ref(storage, `apk/baronda-app.apk`);
    const uploadTask = uploadBytesResumable(storageRef, apkFile);

    setUploadProgress(0);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        toast({ variant: 'destructive', title: 'Unggah Gagal', description: 'Terjadi kesalahan saat mengunggah file.' });
        setUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        form.setValue('appDownloadLink', downloadURL);
        await handleGenericSubmit('appDownloadLink', downloadURL);
        toast({ title: 'Unggah Berhasil', description: 'Tautan unduhan aplikasi telah diperbarui.' });
        setUploadProgress(null);
        setApkFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    );
  };
  
  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          toast({ title: 'Berhasil', description: 'Tautan berhasil disalin ke clipboard.'});
      }).catch(() => {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyalin tautan.'});
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Aplikasi</CardTitle>
        <CardDescription>Kelola konfigurasi dasar dan rilis aplikasi Baronda.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Form {...form}>
          <form className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Unggah Aplikasi (APK)</h3>
              <div className="p-4 border rounded-lg space-y-4">
                <Alert>
                  <UploadCloud className="h-4 w-4" />
                  <AlertTitle>Manajemen Rilis Aplikasi</AlertTitle>
                  <AlertDescription>
                    Gunakan formulir di bawah ini untuk mengunggah dan memperbarui tautan unduhan file APK.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Input
                    id="apk-upload"
                    type="file"
                    accept=".apk"
                    onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                    ref={fileInputRef}
                  />
                  <Button onClick={handleApkUpload} disabled={!apkFile || uploadProgress !== null}>
                    {uploadProgress !== null ? <Loader2 className="animate-spin" /> : <UploadCloud />}
                  </Button>
                </div>
                {uploadProgress !== null && (
                  <Progress value={uploadProgress} className="w-full" />
                )}
                
                <FormField
                    control={form.control}
                    name="appDownloadLink"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tautan Unduhan Aktif</FormLabel>
                        <div className="flex items-center gap-2">
                         <FormControl>
                            <Input {...field} readOnly placeholder="Unggah APK untuk mendapatkan tautan..." />
                         </FormControl>
                          <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(field.value || '')} disabled={!field.value}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mode Pemeliharaan</h3>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Aktifkan Mode Pemeliharaan</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Jika aktif, pengguna tidak akan bisa mengakses aplikasi.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="maintenanceMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleGenericSubmit('maintenanceMode', checked);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
