
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, QrCode, ArrowLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Akses Kamera Ditolak',
          description: 'Mohon izinkan akses kamera di browser Anda untuk menggunakan fitur ini.',
        });
      }
    };
    getCameraPermission();
  }, [toast]);

  const handleScan = async () => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Error', description: 'Token absensi tidak ditemukan.' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Simulate a successful scan by using the token from the URL
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const schedulesRef = collection(db, 'schedules');
      const q = query(schedulesRef, where("qrToken", "==", token));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Token absensi tidak valid atau tidak ditemukan.");
      }
      
      const scheduleDoc = querySnapshot.docs[0];
      const scheduleData = scheduleDoc.data();
      const scheduleRef = scheduleDoc.ref;

      const expires = (scheduleData.qrTokenExpires as Timestamp)?.toDate();

      if (!expires || new Date() > expires) {
        throw new Error('Token absensi sudah kedaluwarsa. Mohon minta token baru dari admin.');
      }

      if (scheduleData.status !== 'Pending') {
         throw new Error('Jadwal ini tidak valid atau sudah dimulai.');
      }
      
      await updateDoc(scheduleRef, {
        status: 'In Progress',
        qrToken: null, // Consume the token
        qrTokenExpires: null,
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
            {hasCameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-white" />}
            
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

            {hasCameraPermission === false && (
                <Alert variant="destructive" className="m-4">
                    <AlertTitle>Kamera Tidak Diizinkan</AlertTitle>
                    <AlertDescription>
                        Mohon izinkan akses kamera di browser Anda untuk menggunakan fitur ini.
                    </AlertDescription>
                </Alert>
            )}
          </div>
          {token ? (
            <Button onClick={handleScan} className="w-full" disabled={isSubmitting || !hasCameraPermission}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Memvalidasi...' : `Konfirmasi Absen`}
            </Button>
          ) : (
             <Alert>
                <AlertTitle>Pindai Kode QR</AlertTitle>
                <AlertDescription>
                    Pindai kode QR dari admin untuk mendapatkan token dan tombol konfirmasi akan muncul di sini.
                </AlertDescription>
            </Alert>
          )}
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
