
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, QrCode, ArrowLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    // In a real application, you would request camera permissions here.
    // For this prototype, we'll simulate it.
    setTimeout(() => setCameraPermission(true), 500); 
  }, []);

  const handleScan = async () => {
    if (!scheduleId) {
      toast({ variant: 'destructive', title: 'Error', description: 'ID Jadwal tidak ditemukan.' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const scheduleRef = doc(db, 'schedules', scheduleId);
      const scheduleSnap = await getDoc(scheduleRef);

      if (!scheduleSnap.exists() || scheduleSnap.data().status !== 'Pending') {
         throw new Error('Jadwal ini tidak valid atau sudah dimulai.');
      }
      
      // Simulate a successful scan
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await updateDoc(scheduleRef, {
        status: 'In Progress'
      });
      
      toast({ title: 'Absen Berhasil', description: 'Status patroli Anda telah diperbarui.' });
      router.push('/petugas');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memulai patroli.';
      toast({ variant: 'destructive', title: 'Gagal', description: errorMessage });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Pindai QR Code Absensi</CardTitle>
          <CardDescription>
            Arahkan kamera ke QR code yang diberikan oleh admin untuk memulai patroli.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-square w-full bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden">
            {cameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-white" />}
            {cameraPermission === false && (
                <Alert variant="destructive" className="m-4">
                    <AlertTitle>Kamera Tidak Diizinkan</AlertTitle>
                    <AlertDescription>
                        Mohon izinkan akses kamera di browser Anda untuk menggunakan fitur ini.
                    </AlertDescription>
                </Alert>
            )}
            {cameraPermission && (
                 <video className="w-full h-full object-cover" playsInline autoPlay muted />
            )}
          </div>
          <Button onClick={handleScan} className="w-full" disabled={isSubmitting || !cameraPermission}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            {isSubmitting ? 'Memindai...' : 'Mulai Patroli'}
          </Button>
           <Button variant="outline" className="w-full" asChild>
                <Link href="/petugas/schedule">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Batal & Kembali
                </Link>
           </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScanPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ScanPageContent />
        </Suspense>
    )
}
