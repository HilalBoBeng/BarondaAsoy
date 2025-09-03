
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, Upload } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult, Html5QrcodeScanType } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = useState('Arahkan kamera ke QR code absensi...');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const qrReaderId = "qr-reader-container";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const processDecodedText = async (decodedText: string) => {
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
      } finally {
         setIsProcessing(false);
      }
  };
  
  useEffect(() => {
    let isMounted = true;
    html5QrCodeRef.current = new Html5Qrcode(qrReaderId);

    const startScanner = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!isMounted) return;
        setHasCameraPermission(true);

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        };

        html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          config,
          (decodedText, decodedResult) => {
            if (!isProcessing) {
              processDecodedText(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore.
          }
        ).catch(err => {
          if (isMounted) setError("Gagal memulai pemindai kamera.");
        });

      } catch (permissionError) {
        if(isMounted) setHasCameraPermission(false);
      }
    };
    
    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(e => console.error("Gagal menghentikan scanner", e));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (isProcessing) return;
      
      const html5QrCode = new Html5Qrcode(qrReaderId, false);
       try {
        const decodedText = await html5QrCode.scanFile(file, false);
        processDecodedText(decodedText);
      } catch (err) {
        setError("Gagal memindai gambar. Pastikan gambar jelas dan merupakan QR code yang valid.");
      } finally {
        // Reset file input value to allow scanning the same file again
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
          {hasCameraPermission === null ? (
             <div className="w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden border bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : hasCameraPermission === false ? (
              <Alert variant="destructive">
                  <AlertTitle>Akses Kamera Dibutuhkan</AlertTitle>
                  <AlertDescription>Mohon berikan izin akses kamera pada browser Anda untuk menggunakan fitur pemindaian.</AlertDescription>
              </Alert>
          ) : (
             <div id={qrReaderId} className="w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden border bg-muted">
             </div>
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
