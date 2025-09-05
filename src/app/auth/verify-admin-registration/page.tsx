
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { verifyAdminToken } from '@/ai/flows/verify-admin-token';
import Image from 'next/image';

function VerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Sedang memverifikasi token pendaftaran Anda...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token tidak ditemukan. Tautan ini tidak valid.');
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyAdminToken({ token });
        if (result.success) {
          setStatus('success');
          setMessage('Akun Anda telah berhasil dibuat. Silakan periksa email Anda untuk mendapatkan kode akses rahasia untuk masuk.');
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.');
        toast({
          variant: 'destructive',
          title: 'Verifikasi Gagal',
          description: error instanceof Error ? error.message : 'Silakan coba lagi atau hubungi admin.',
        });
      }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, toast]);
  
  const StatusIcon = () => {
    switch (status) {
        case 'verifying':
            return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
        case 'success':
            return <CheckCircle className="h-16 w-16 text-green-500" />;
        case 'error':
            return <AlertCircle className="h-16 w-16 text-destructive" />;
        default:
            return null;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/40">
        <div className="flex flex-col items-center justify-center mb-6 text-center">
            <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
            <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
            <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
        </div>
        <Card className="w-full max-w-md text-center">
             <CardHeader>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <StatusIcon />
                </div>
                <CardTitle className="text-2xl">
                    {status === 'verifying' && 'Memverifikasi...'}
                    {status === 'success' && 'Verifikasi Berhasil!'}
                    {status === 'error' && 'Verifikasi Gagal'}
                </CardTitle>
             </CardHeader>
             <CardContent>
                <p className="text-muted-foreground">{message}</p>
             </CardContent>
             {status !== 'verifying' && (
                <CardFooter className="flex-col gap-4">
                    <p className="text-xs text-muted-foreground">Silakan tutup halaman ini dan kembali ke halaman login.</p>
                    <Button className="w-full" onClick={() => router.push('/auth/staff-login')}>
                        Ke Halaman Login
                    </Button>
                </CardFooter>
            )}
        </Card>
    </div>
  )
}


export default function VerifyAdminRegistrationPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VerificationContent />
        </Suspense>
    )
}

    
