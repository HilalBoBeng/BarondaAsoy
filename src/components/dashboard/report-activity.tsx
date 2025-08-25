"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { triageReport, type TriageReportOutput } from '@/ai/flows/triage-report';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const reportSchema = z.object({
  reportText: z.string().min(10, 'Mohon berikan laporan yang lebih detail.'),
  category: z.enum(['theft', 'vandalism', 'suspicious_person', 'other'], {
      errorMap: () => ({ message: "Kategori harus dipilih." }),
  }),
  location: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const ThreatLevelBadge = ({ level }: { level: TriageReportOutput['threatLevel'] }) => {
    const config = {
        low: { icon: CheckCircle, variant: 'secondary', className: 'bg-green-100 text-green-800', label: 'Rendah' },
        medium: { icon: AlertTriangle, variant: 'secondary', className: 'bg-yellow-100 text-yellow-800', label: 'Sedang' },
        high: { icon: AlertTriangle, variant: 'destructive', className: '', label: 'Tinggi' },
    } as const;
    const { icon: Icon, variant, className, label } = config[level];
    return <Badge variant={variant} className={`capitalize ${className}`}>
        <Icon className="mr-1 h-3 w-3" />
        {label}
    </Badge>
}

export default function ReportActivity() {
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageReportOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportText: '',
    },
  });

  const handleGetLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        form.setValue('location', locationString);
        toast({
          title: 'Lokasi Diperoleh',
          description: `Koordinat: ${locationString}`,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('Gagal mendapatkan lokasi', error);
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: 'Tidak dapat memperoleh lokasi. Mohon aktifkan layanan lokasi.',
        });
        setIsLocating(false);
      }
    );
  };

  const onSubmit = async (data: ReportFormValues) => {
    setIsSubmitting(true);
    setTriageResult(null);
    try {
      const result = await triageReport(data);
      setTriageResult(result);
      
      await addDoc(collection(db, 'reports'), {
        ...data,
        triageResult: result,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Laporan Berhasil Dikirim',
        description: 'Laporan Anda telah kami terima dan analisis.',
      });
      form.reset();
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Lapor Aktivitas Mencurigakan</CardTitle>
        <CardDescription>
          Laporan Anda akan dianalisis oleh AI kami untuk penilaian segera dan disimpan.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
              <FormItem>
                <FormLabel>Lokasi (Opsional)</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="w-full"
                  >
                    {isLocating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Dapatkan Lokasi Saat Ini
                  </Button>
                </div>
                 {form.watch('location') && <p className="text-sm text-muted-foreground mt-2">📍 {form.watch('location')}</p>}
              </FormItem>
            </div>
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
