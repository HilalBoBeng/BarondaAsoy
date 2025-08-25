
"use client";

import { useEffect, useState } from 'react';
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
import { Loader2, Send, AlertTriangle, CheckCircle, LogIn } from 'lucide-react';
import { Badge } from '../ui/badge';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { User } from 'firebase/auth';
import Link from 'next/link';
import { Input } from '../ui/input';

const reportSchema = z.object({
  reporterName: z.string().min(1, "Nama pelapor tidak boleh kosong."),
  reportText: z.string().min(10, 'Mohon berikan laporan yang lebih detail (minimal 10 karakter).'),
  category: z.enum(['theft', 'vandalism', 'suspicious_person', 'other'], {
      errorMap: () => ({ message: "Kategori harus dipilih." }),
  }),
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

export default function ReportActivity({ user }: { user: User | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageReportOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reporterName: '',
      reportText: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.setValue('reporterName', user.displayName || user.email || '');
    }
  }, [user, form]);


  const onSubmit = async (data: ReportFormValues) => {
    setIsSubmitting(true);
    setTriageResult(null);
    try {
      // Uppercase the report text
      const processedData = {
        ...data,
        reportText: data.reportText.toUpperCase(),
      };

      const result = await triageReport(processedData);
      setTriageResult(result);
      
      await addDoc(collection(db, 'reports'), {
        ...processedData,
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
          Laporan Anda akan dianalisis oleh AI untuk penilaian segera dan disimpan.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
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
