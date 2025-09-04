// This is a placeholder file for the new editor page.
// The actual implementation will be provided in a subsequent step.
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings, Text, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const menuSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label tidak boleh kosong."),
});

const configSchema = z.object({
  appName: z.string().min(1, "Nama aplikasi tidak boleh kosong."),
  appTagline: z.string().min(1, "Tagline tidak boleh kosong."),
  appLogoUrl: z.string().url("URL Logo tidak valid."),
  copyrightText: z.string().min(1, "Teks copyright tidak boleh kosong."),
  adminMenus: z.array(menuSchema),
  petugasMenus: z.array(menuSchema),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function EditorPage() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      appName: '',
      appTagline: '',
      appLogoUrl: '',
      copyrightText: '',
      adminMenus: [],
      petugasMenus: [],
    }
  });

  const { fields: adminMenuFields, replace: replaceAdminMenus } = useFieldArray({
    control: form.control,
    name: "adminMenus",
  });
  const { fields: petugasMenuFields, replace: replacePetugasMenus } = useFieldArray({
    control: form.control,
    name: "petugasMenus",
  });

  useEffect(() => {
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.role !== 'super_admin') {
      toast({ variant: 'destructive', title: 'Akses Ditolak', description: 'Halaman ini hanya untuk Super Admin.' });
      router.push('/admin');
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      const docRef = doc(db, 'app_settings', 'live_editor');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ConfigFormValues;
        form.reset(data);
      } else {
        // Load from a default config file or set defaults
        const defaultConfig = {
            appName: "Baronda",
            appTagline: "Kelurahan Kilongan",
            appLogoUrl: "https://iili.io/KJ4aGxp.png",
            copyrightText: "© {year} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.",
            adminMenus: [
                { id: 'dashboard', label: 'Dasbor' }, { id: 'profile', label: 'Profil Saya' },
                { id: 'reports', label: 'Laporan Masuk' }, { id: 'announcements', label: 'Pengumuman' },
                { id: 'users', label: 'Manajemen Pengguna' }, { id: 'schedule', label: 'Jadwal Patroli' },
                { id: 'attendance', label: 'Daftar Hadir' }, { id: 'dues', label: 'Iuran Warga' },
                { id: 'honor', label: 'Honorarium' }, { id: 'activityLog', label: 'Log Admin' },
                { id: 'tools', label: 'Lainnya' }, { id: 'emergencyContacts', label: 'Kontak Darurat' },
                { id: 'notifications', label: 'Notifikasi' }, {id: 'editor', label: 'Live Editor' }
            ],
            petugasMenus: [
                { id: 'dashboard', label: 'Dasbor' }, { id: 'profile', label: 'Profil Saya' },
                { id: 'reports', label: 'Laporan Warga' }, { id: 'schedule', label: 'Jadwal Saya' },
                { id: 'patrolLog', label: 'Patroli & Log' }, { id: 'dues', label: 'Iuran Warga' },
                { id: 'honor', label: 'Honor Saya' }, { id: 'announcements', label: 'Pengumuman' },
                { id: 'notifications', label: 'Notifikasi' }, { id: 'tools', label: 'Lainnya' },
                { id: 'emergencyContacts', label: 'Kontak Darurat' }
            ]
        };
        form.reset(defaultConfig);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [form, router, toast]);

  const onSubmit = async (data: ConfigFormValues) => {
    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'app_settings', 'live_editor');
      await setDoc(docRef, data, { merge: true });
      toast({ title: "Berhasil", description: "Konfigurasi aplikasi berhasil disimpan. Perubahan akan terlihat setelah me-refresh halaman." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menyimpan konfigurasi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
      return <div>Loading editor...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Editor Aplikasi</CardTitle>
        <CardDescription>Ubah teks, logo, dan menu di seluruh aplikasi dari sini. Perubahan memerlukan refresh halaman untuk terlihat.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <Accordion type="multiple" defaultValue={['general', 'admin-menu']} className="w-full">
                {/* General Settings */}
                <AccordionItem value="general">
                    <AccordionTrigger>
                        <div className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan Umum</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <FormField control={form.control} name="appName" render={({ field }) => (
                            <FormItem><FormLabel>Nama Aplikasi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="appTagline" render={({ field }) => (
                            <FormItem><FormLabel>Tagline Aplikasi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="appLogoUrl" render={({ field }) => (
                            <FormItem><FormLabel>URL Logo Aplikasi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="copyrightText" render={({ field }) => (
                            <FormItem><FormLabel>Teks Copyright</FormLabel><FormControl><Input {...field} placeholder="Gunakan {year} untuk tahun saat ini" /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </AccordionContent>
                </AccordionItem>

                {/* Admin Menu */}
                <AccordionItem value="admin-menu">
                    <AccordionTrigger>
                        <div className="flex items-center gap-2"><Text className="h-5 w-5" /> Label Menu Admin</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {adminMenuFields.map((field, index) => (
                           <FormField
                            key={field.id}
                            control={form.control}
                            name={`adminMenus.${index}.label`}
                            render={({ field: inputField }) => (
                                <FormItem>
                                    <FormLabel className="capitalize text-muted-foreground">{field.id.replace(/([A-Z])/g, ' $1')}</FormLabel>
                                    <FormControl><Input {...inputField} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                        ))}
                    </AccordionContent>
                </AccordionItem>

                {/* Petugas Menu */}
                <AccordionItem value="petugas-menu">
                    <AccordionTrigger>
                         <div className="flex items-center gap-2"><Text className="h-5 w-5" /> Label Menu Petugas</div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {petugasMenuFields.map((field, index) => (
                             <FormField
                            key={field.id}
                            control={form.control}
                            name={`petugasMenus.${index}.label`}
                            render={({ field: inputField }) => (
                                <FormItem>
                                    <FormLabel className="capitalize text-muted-foreground">{field.id.replace(/([A-Z])/g, ' $1')}</FormLabel>
                                    <FormControl><Input {...inputField} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                        ))}
                    </AccordionContent>
                </AccordionItem>

            </Accordion>
            
            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Perubahan
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
