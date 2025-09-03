
"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp, serverTimestamp, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, Upload, Camera, CheckCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

// Check if BarcodeDetector is available in the browser
const isBarcodeDetectorSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'permission_denied' | 'unsupported'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'start' | 'end' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const type = searchParams.get('type') as 'start' | 'end';
    if (type) {
      setScanType(type);
    } else {
      setErrorMessage("Tipe pemindaian tidak valid.");
      setStatus('error');
    }
  }, [searchParams]);

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
  };
  
  const processDecodedText = useCallback(async (decodedText: string) => {
    if (status === 'processing' || status === 'success') return;
    setStatus('processing');
    setErrorMessage(null);
    stopCamera();

    try {
      if (!scanType) throw new Error("Tipe pemindaian tidak valid.");

      const tokenField = scanType === 'start' ? "qrTokenStart" : "qrTokenEnd";
      
      const schedulesRef = collection(db, 'schedules');
      const q = query(schedulesRef, where(tokenField, "==", decodedText));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Token absensi tidak valid atau tidak ditemukan.");
      }
      
      const scheduleDoc = querySnapshot.docs[0];
      const scheduleData = scheduleDoc.data();
      const scheduleRef = scheduleDoc.ref;

      const expiresField = scanType === 'start' ? 'qrTokenStartExpires' : 'qrTokenEndExpires';
      const expires = (scheduleData[expiresField] as Timestamp)?.toDate();

      if (!expires || new Date() > expires) {
        throw new Error('Token absensi sudah kedaluwarsa. Mohon minta token baru dari admin.');
      }
      
      let updatePayload: any = {};
      if(scanType === 'start') {
          if (scheduleData.status !== 'Pending') throw new Error('Jadwal ini tidak valid atau sudah dimulai.');
          updatePayload = {
              status: 'In Progress',
              patrolStartTime: serverTimestamp(),
              qrTokenStart: null,
              qrTokenStartExpires: null,
          }
      } else {
          if (scheduleData.status !== 'In Progress') throw new Error('Patroli belum dimulai, tidak bisa diakhiri.');
          updatePayload = {
              status: 'Completed',
              patrolEndTime: serverTimestamp(),
              qrTokenEnd: null,
              qrTokenEndExpires: null
          }
          
          const staffRef = doc(db, 'staff', scheduleData.officerId);
          await updateDoc(staffRef, { points: increment(10) });
      }

      await updateDoc(scheduleRef, updatePayload);
      
      setStatus('success');
      toast({ title: 'Absen Berhasil', description: `Status patroli telah diperbarui.` });

      setTimeout(() => {
          router.push('/petugas/schedule');
      }, 2000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses QR code.';
      setErrorMessage(msg);
      setStatus('error');
    }
  }, [status, router, toast, scanType]);

  const scanFrame = useCallback(async (detector: any) => {
    if (videoRef.current && videoRef.current.readyState === 4) {
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          processDecodedText(barcodes[0].rawValue);
        } else {
          animationFrameId.current = requestAnimationFrame(() => scanFrame(detector));
        }
      } catch (e) {
        console.error('Scan Error:', e);
        animationFrameId.current = requestAnimationFrame(() => scanFrame(detector));
      }
    } else {
       animationFrameId.current = requestAnimationFrame(() => scanFrame(detector));
    }
  }, [processDecodedText]);

  useEffect(() => {
    if (!isBarcodeDetectorSupported()) {
        setStatus('unsupported');
        setErrorMessage("Browser Anda tidak mendukung deteksi barcode. Coba gunakan browser lain seperti Chrome atau unggah gambar QR.");
        return;
    }

    if (scanType && status === 'idle') {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    setStatus('scanning');
                    // @ts-ignore
                    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    scanFrame(detector);
                }
            })
            .catch(err => {
                console.error("Camera access error:", err);
                setStatus('permission_denied');
                setErrorMessage("Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan browser Anda.");
            });
    }

    return () => {
        stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanType, status]);


  const handleFileSelect = async (file: File) => {
    if (!isBarcodeDetectorSupported()) {
        setStatus('unsupported');
        return;
    }
    if (!file) return;

    setStatus('processing');
    setErrorMessage(null);
    try {
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const imageBitmap = await createImageBitmap(file);
        const barcodes = await detector.detect(imageBitmap);

        if (barcodes.length > 0) {
            processDecodedText(barcodes[0].rawValue);
        } else {
            throw new Error("Tidak dapat menemukan QR code pada gambar.");
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal memproses gambar.";
        setErrorMessage(msg);
        setStatus('error');
    }
  };
  
   const handleTryAgain = () => {
    setErrorMessage(null);
    setStatus('idle'); // This will re-trigger the useEffect to start the camera
  };


  if (status === 'success') {
    return (
        <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                 <CheckCircle className="h-16 w-16 text-green-500 animate-in fade-in zoom-in-50" />
                 <p className="text-lg font-semibold">Absen Berhasil!</p>
                 <p className="text-muted-foreground">Anda akan dialihkan kembali ke halaman jadwal...</p>
                 <Loader2 className="h-5 w-5 animate-spin" />
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Pindai Kode QR untuk {scanType === 'start' ? 'Memulai' : 'Mengakhiri'} Tugas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden shadow-inner flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[250px] h-[250px] aspect-square border-4 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
            </div>
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white hover:text-white"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="h-5 w-5" />
            </Button>
          </div>
          
           <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => e.target.files && e.target.files.length > 0 && handleFileSelect(e.target.files[0])} />

          {status === 'processing' && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">Memvalidasi token...</p>
             </div>
          )}

          {(status === 'error' || status === 'permission_denied' || status === 'unsupported') && errorMessage && (
             <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
                <Button onClick={handleTryAgain} className="mt-2" size="sm">Coba Lagi</Button>
            </Alert>
          )}

           <Button variant="secondary" className="w-full" asChild>
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

    