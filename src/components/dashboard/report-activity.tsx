
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
import { Loader2, Send, AlertTriangle, CheckCircle, LogIn, Eye, Globe, MapPin, ShieldBan, Info, EyeOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, app } from '@/lib/firebase/client';
import { getAuth, type User } from 'firebase/auth';
import type { AppUser } from '@/lib/types';
import Link from 'next/link';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

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

export default function ReportActivity() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageReportOutput | null>(null);
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const auth = getAuth(app);


  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reporterName: '',
      reportText: '',
      visibility: 'public',
    },
  });
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as AppUser;
                setUserInfo(userData);
                form.setValue('reporterName', userData.displayName || currentUser.email || '');
            }
        }
    });
    return () => unsubscribe();
  }, [auth, form]);


  const onSubmit = async (data: ReportFormValues) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Anda harus masuk untuk melapor.' });
        return;
    }
    setIsSubmitting(true);
    setTriageResult(null);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
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
  
  if (userInfo?.isBlocked) {
    return (
        <Alert variant="destructive">
            <ShieldBan className="h-4 w-4" />
            <AlertTitle>Akun Diblokir</AlertTitle>
            <AlertDescription>
                Anda tidak dapat mengirim laporan karena akun Anda telah diblokir oleh admin.
            </AlertDescription>
        </Alert>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Lapor Aktivitas Mencurigakan</CardTitle>
        <CardDescription>
          Laporan Anda akan dianalisis oleh AI untuk penilaian segera.
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
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="public" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-1.5">
                              <Globe className="h-4 w-4" /> Publik
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="private" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-1.5">
                               <EyeOff className="h-4 w-4" /> Privat
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
