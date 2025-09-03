
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
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult } from 'html5-qrcode';

const qrReaderId = "qr-reader-container";

function ScanPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState('Arahkan kamera ke QR code absensi...');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  const processDecodedText = useCallback(async (decodedText: string) => {
    if (isProcessing) return;
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
      setMessage('Gagal. Silakan coba lagi.');
      setTimeout(() => {
          if (html5QrCodeRef.current && !html5QrCodeRef.current.isScanning) {
            startScanner();
          }
      }, 2000);
    } finally {
       setIsProcessing(false);
    }
  }, [isProcessing, router, toast]);

  const startScanner = useCallback(() => {
    if (html5QrCodeRef.current && !html5QrCodeRef.current.isScanning && scannerStarted.current) {
        setError(null);
        setMessage('Arahkan kamera ke QR code absensi...');
        setIsProcessing(false);
        const config = { fps: 10, qrbox: 250 };
        
        html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            config,
            (decodedText, decodedResult) => {
                if (html5QrCodeRef.current?.isScanning) {
                    html5QrCodeRef.current.stop();
                }
                processDecodedText(decodedText);
            },
            (errorMessage) => { /* ignore */ }
        ).catch((err) => {
             setError("Gagal memulai kamera. Pastikan Anda memberikan izin.");
             setHasCameraPermission(false);
        });
    }
  }, [processDecodedText]);
  
  useEffect(() => {
    if (!scannerStarted.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrReaderId);
        scannerStarted.current = true;

        Html5Qrcode.getCameras().then(devices => {
          if (devices && devices.length) {
            setHasCameraPermission(true);
            startScanner();
          } else {
            setHasCameraPermission(false);
          }
        }).catch(err => {
          setHasCameraPermission(false);
          setError("Tidak dapat mengakses kamera. Mohon periksa izin pada browser Anda.");
        });
    }

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(e => console.error("Gagal menghentikan scanner.", e));
      }
    };
  }, [startScanner]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isProcessing) {
       if (html5QrCodeRef.current?.isScanning) {
          await html5QrCodeRef.current.stop();
      }
       try {
        const decodedText = await html5QrCodeRef.current?.scanFile(file, false);
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
