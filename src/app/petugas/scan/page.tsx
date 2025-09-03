
"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, Upload } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';

const qrReaderId = "qr-reader-container";

function ScanPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState('Arahkan kamera ke QR code absensi...');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use useRef to hold the scanner instance to prevent re-renders from affecting it.
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const processDecodedText = useCallback(async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setMessage('Memvalidasi token...');
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
      setMessage('Gagal. Silakan coba lagi.');
      setIsProcessing(false);
    }
  }, [isProcessing, router, toast]);
  
  // This useEffect handles scanner setup and teardown only. Runs once.
  useEffect(() => {
    // Only instantiate scanner on client
    if (typeof window === "undefined") {
        return;
    }
      
    html5QrCodeRef.current = new Html5Qrcode(qrReaderId);
    const qrCodeScanner = html5QrCodeRef.current;

    const startScanner = async () => {
      try {
        await Html5Qrcode.getCameras();
        setHasCameraPermission(true);
        
        qrCodeScanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText, decodedResult) => {
            if (!isProcessing) {
               processDecodedText(decodedText);
            }
          },
          (errorMessage) => { /* ignore */ }
        ).catch(err => {
            setHasCameraPermission(false);
            setError("Gagal memulai kamera. Mohon berikan izin pada browser Anda.");
        });

      } catch (err) {
        setHasCameraPermission(false);
        setError("Kamera tidak ditemukan atau akses ditolak. Mohon berikan izin pada browser Anda.");
      }
    };

    startScanner();

    // The cleanup function is critical.
    return () => {
      if (qrCodeScanner && qrCodeScanner.isScanning) {
        qrCodeScanner.stop().catch(err => {
          console.warn("Peringatan saat menghentikan pemindai:", err);
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const scanner = html5QrCodeRef.current;
    if (file && !isProcessing && scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        const decodedText = await scanner.scanFile(file, false);
        if (decodedText) {
          processDecodedText(decodedText);
        }
      } catch (err) {
        setError("Gagal memindai gambar. Pastikan gambar jelas dan merupakan QR code yang valid.");
      } finally {
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Pindai Kode QR Absensi</CardTitle>
          {!isProcessing && (
              <CardDescription>
                {message}
              </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div id={qrReaderId} className="w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden border bg-muted">
             {hasCameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          </div>

           {hasCameraPermission === false && (
              <Alert variant="destructive">
                  <AlertTitle>Akses Kamera Dibutuhkan</AlertTitle>
                  <AlertDescription>Mohon berikan izin akses kamera pada browser Anda untuk menggunakan fitur pemindaian.</AlertDescription>
              </Alert>
          )}

           <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
             <Upload className="mr-2 h-4 w-4" /> Unggah Gambar QR
            </Button>
            <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {isProcessing && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">{message}</p>
             </div>
          )}
          {error && !isProcessing && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
           <Button variant="secondary" className="w-full" asChild>
                <Link href="/petugas">
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
