
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5QrcodeScanner, type Html5Qrcode } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState('Arahkan kamera ke QR code absensi...');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        videoConstraints: {
            facingMode: "environment"
        }
      },
      false // verbose
    );

    const onScanSuccess = async (decodedText: string, decodedResult: any) => {
      scanner.clear();
      setIsProcessing(true);
      setMessage('Memvalidasi token...');
      setError(null);

      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const schedulesRef = collection(db, 'schedules');
        const q = query(schedulesRef, where("qrToken", "==", decodedText));
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
          qrToken: null, 
          qrTokenExpires: null,
        });
        
        toast({ title: 'Absen Berhasil', description: 'Status patroli Anda telah diperbarui.' });
        router.push('/petugas');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Gagal memulai patroli.';
        setError(errorMessage);
        setIsProcessing(false);
        // Restart scanning after a delay
        setTimeout(() => {
            if (document.getElementById('qr-reader')) {
                scanner.render(onScanSuccess, onScanFailure);
            }
        }, 3000);
      }
    };

    const onScanFailure = (error: any) => {
      // ignore scan failure, it happens every frame if no QR code is found
    };
    
    scanner.render(onScanSuccess, onScanFailure);
    
    return () => {
      if (scanner) {
          try {
              scanner.clear();
          } catch(e) {
              console.error("Failed to clear scanner", e);
          }
      }
    };
  }, [router, toast]);


  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Pindai Kode QR Absensi</CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="qr-reader" className="w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden border">
          </div>
          {isProcessing && !error && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">{message}</p>
             </div>
          )}
          {error && (
             <Alert variant="destructive">
                <AlertTitle>Validasi Gagal</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
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
