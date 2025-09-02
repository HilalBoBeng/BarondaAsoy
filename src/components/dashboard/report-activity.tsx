
"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { triageReport, type TriageReportOutput } from '@/ai/flows/triage-report';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, AlertTriangle, CheckCircle, LogIn, Eye, Globe, MapPin } from 'lucide-react';
import { Badge } from '../ui/badge';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { User } from 'firebase/auth';
import Link from 'next/link';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const reportSchema = z.object({
  reporterName: z.string().min(1, "Nama pelapor tidak boleh kosong."),
  reportText: z.string().min(10, 'Mohon berikan laporan yang lebih detail (minimal 10 karakter).'),
  category: z.enum(['theft', 'vandalism', 'suspicious_person', 'other'], {
      errorMap: () => ({ message: "Kategori harus dipilih." }),
  }),
  visibility: z.enum(['public', 'private'], { required_error: "Visibilitas laporan harus dipilih." }),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const ThreatLevelBadge = ({ level }: { level: TriageReportOutput['threatLevel'] }) => {
    const config = {
        low: { icon: CheckCircle, variant: 'secondary', className: 'bg-green-100 text-green-800', label: 'Rendah' },
        medium: { icon: AlertTriangle, variant: 'secondary', className: 'bg-yellow-100 text-yellow-800', label: 'Sedang' },
        high: { icon: AlertTriangle, variant: 'destructive', className: '', label: 'Tinggi' },
    } as const;
    const { icon: Icon, variant, className, label } = config[level];
    return <Badge variant={variant || 'secondary'} className={`capitalize ${className}`}>
        <Icon className="mr-1 h-3 w-3" />
        {label}
    </Badge>
}

export default function ReportActivity({ user }: { user: User | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageReportOutput | null>(null);
  const { toast } = useToast();
  const [currentPosition, setCurrentPosition] = useState<{lat: number, lng: number} | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reporterName: '',
      reportText: '',
      visibility: 'public',
    },
  });
  
  useEffect(() => {
    // This is a workaround to get the env var on the client.
    // In a real app, you might use a different approach.
    setMapsApiKey(process.env.NEXT_PUBLIC_MAPS_API_KEY || null);
  }, []);

  useEffect(() => {
    if (user) {
      form.setValue('reporterName', user.displayName || user.email || '');
    }
  }, [user, form]);
  
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const pos = { lat: latitude, lng: longitude };
          setCurrentPosition(pos);
          form.setValue('location', pos);
        },
        (error) => {
          console.error("Error getting location", error);
          toast({
              variant: "destructive",
              title: "Gagal Mendapatkan Lokasi",
              description: "Pastikan Anda mengizinkan akses lokasi di browser Anda.",
          });
        }
      );
    }
  }, [form, toast]);


  const onSubmit = async (data: ReportFormValues) => {
    setIsSubmitting(true);
    setTriageResult(null);
    try {
      const result = await triageReport(data);
      setTriageResult(result);
      
      await addDoc(collection(db, 'reports'), {
        ...data,
        reporterEmail: user?.email, // Save user's email
        triageResult: result,
        userId: user?.uid,
        createdAt: serverTimestamp(),
        status: 'new'
      });

      toast({
        title: 'Laporan Berhasil Dikirim',
        description: 'Laporan Anda telah kami terima dan analisis.',
      });
      form.reset({
        reporterName: user?.displayName || user?.email || '',
        reportText: '',
        category: undefined,
        visibility: 'public',
      });
    } catch (error) {
      console.error('Pengiriman gagal', error);
      toast({
        variant: 'destructive',
        title: 'Pengiriman Gagal',
        description: 'Terjadi kesalahan saat mengirim laporan Anda. Silakan coba lagi.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!user) {
    return (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
            <p className="mb-4 text-muted-foreground">Anda harus masuk untuk membuat laporan.</p>
            <Button asChild>
                <Link href="/auth/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Masuk untuk Melapor
                </Link>
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
                Belum punya akun? <Link href="/auth/register" className="underline text-primary">Daftar di sini</Link>.
            </p>
        </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardDescription>
          Laporan Anda akan dianalisis oleh AI untuk penilaian segera dan disimpan. Lokasi Anda saat ini akan dilampirkan.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {mapsApiKey ? (
                 <div className="h-48 w-full rounded-md overflow-hidden border">
                    <APIProvider apiKey={mapsApiKey}>
                        <Map
                            defaultCenter={{ lat: -1.48, lng: 119.55 }} // Default to Indonesia
                            center={currentPosition || undefined}
                            defaultZoom={15}
                            gestureHandling={'greedy'}
                            disableDefaultUI={true}
                            mapId="baronda-map"
                        >
                            {currentPosition && <AdvancedMarker position={currentPosition} />}
                        </Map>
                    </APIProvider>
                 </div>
             ) : (
                <Card className="w-full bg-destructive/10 border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive text-base">Konfigurasi Peta Diperlukan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-destructive/80">Fitur peta tidak dapat dimuat. Admin perlu mengkonfigurasi Google Maps API Key.</p>
                    </CardContent>
                </Card>
             )}
             <FormField
                control={form.control}
                name="reporterName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pelapor</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly className="bg-muted/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="reportText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jelaskan aktivitasnya</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Contoh: Saya melihat seseorang melihat ke dalam jendela mobil di Jalan Utama."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="theft">Pencurian</SelectItem>
                        <SelectItem value="vandalism">Vandalisme</SelectItem>
                        <SelectItem value="suspicious_person">Orang Mencurigakan</SelectItem>
                        <SelectItem value="other">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Visibilitas Laporan</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="public" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <div>
                            <p>Publik</p>
                            <p className="text-xs text-muted-foreground">Bisa dilihat oleh semua warga di dasbor.</p>
                          </div>
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="private" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2">
                           <Eye className="h-4 w-4" />
                           <div>
                                <p>Privat</p>
                                <p className="text-xs text-muted-foreground">Hanya bisa dilihat oleh Anda dan petugas.</p>
                           </div>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
           
            {triageResult && (
                <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            Hasil Analisis AI: <ThreatLevelBadge level={triageResult.threatLevel} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground"><span className='font-semibold text-foreground'>Alasan:</span> {triageResult.reason}</p>
                    </CardContent>
                </Card>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kirim Laporan
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
