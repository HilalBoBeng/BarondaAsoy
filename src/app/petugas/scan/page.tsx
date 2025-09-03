
"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, Upload, Camera } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    html5QrCodeRef.current = new Html5Qrcode('qr-reader-container', { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
  }, []);

  const processDecodedText = useCallback(async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
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
      setIsProcessing(false);
    }
  }, [isProcessing, router, toast]);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCaptureAndProcess = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      if (html5QrCodeRef.current) {
         html5QrCodeRef.current.scanFile(dataURLtoFile(imageDataUrl, 'capture.png'), false)
           .then(decodedText => {
             processDecodedText(decodedText);
           })
           .catch(err => {
             setError("Tidak ada QR code yang terdeteksi pada gambar. Coba lagi.");
           });
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && html5QrCodeRef.current) {
      try {
        const decodedText = await html5QrCodeRef.current.scanFile(file, false);
        processDecodedText(decodedText);
      } catch (err) {
        setError("Gagal memindai gambar. Pastikan gambar jelas dan merupakan QR code yang valid.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  function dataURLtoFile(dataurl: string, filename: string) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)?.[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Pindai Kode QR Absensi</CardTitle>
          <CardDescription>
            Arahkan kamera ke kode QR, lalu tekan tombol Ambil Gambar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="qr-reader-container" style={{ display: 'none' }}></div>
          <video
            ref={videoRef}
            className="w-full aspect-square rounded-lg bg-muted object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

           {hasCameraPermission === false && (
              <Alert variant="destructive">
                  <AlertTitle>Akses Kamera Dibutuhkan</AlertTitle>
                  <AlertDescription>Mohon berikan izin akses kamera pada browser Anda untuk menggunakan fitur ini.</AlertDescription>
              </Alert>
          )}

          <Button className="w-full" onClick={handleCaptureAndProcess} disabled={isProcessing || !hasCameraPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Ambil Gambar & Proses
          </Button>
          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
            <Upload className="mr-2 h-4 w-4" /> Unggah Gambar QR
          </Button>
          <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {isProcessing && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">Memvalidasi token...</p>
             </div>
          )}
          {error && !isProcessing && (
             <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
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

    