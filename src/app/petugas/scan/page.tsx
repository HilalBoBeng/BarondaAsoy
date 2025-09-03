
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
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'start' | 'end' | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const type = searchParams.get('type') as 'start' | 'end';
    if (type) {
      setScanType(type);
    } else {
      setErrorMessage("Tipe pemindaian tidak valid.");
      setStatus('error');
    }
  }, [searchParams]);

  const processDecodedText = useCallback(async (decodedText: string) => {
    if (status === 'processing' || status === 'success') return;
    setStatus('processing');
    setErrorMessage(null);

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
      } else { // 'end'
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

  const startScanner = useCallback(() => {
    if (!readerRef.current || !scannerRef.current) return;
    setStatus('scanning');
    setErrorMessage(null);

    const config = {
      fps: 10,
      qrbox: 250,
      rememberLastUsedCamera: true,
      supportedScanTypes: [0] // SCAN_TYPE_CAMERA
    };
    
    scannerRef.current.start(
      { facingMode: "environment" },
      config,
      processDecodedText,
      (error) => { /* ignore */ }
    ).catch(err => {
      setErrorMessage("Gagal memulai kamera. Mohon berikan izin akses kamera.");
      setStatus('error');
    });
  }, [processDecodedText]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
            const decodedText = await scannerRef.current?.scanFile(file, false);
            if (decodedText) {
                processDecodedText(decodedText);
            }
        } catch (err) {
            setErrorMessage("Tidak dapat menemukan QR code pada gambar.");
            setStatus('error');
        }
    }
  };


  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('qr-reader', {
         experimentalFeatures: {
            useOffscreenCanvas: true,
         },
      });
    }
    
    const scanner = scannerRef.current;
    
    if (scanType && status === 'idle') {
        startScanner();
    }

    return () => {
      if (scanner?.isScanning) {
          scanner.stop().catch(console.error);
      }
    };
  }, [scanType, status, startScanner]);

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
          <div id="qr-reader-container" className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden shadow-inner">
            <div id="qr-reader" ref={readerRef} className="w-full h-full"></div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 bg-black/30 hover:bg-black/50 text-white rounded-full h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Unggah gambar QR"
            >
              <Upload className="h-5 w-5" />
            </Button>
          </div>

          {status === 'processing' && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">Memvalidasi token...</p>
             </div>
          )}

          {status === 'error' && errorMessage && (
             <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
                {errorMessage.includes("kamera") && <Button onClick={startScanner} className="mt-2">Coba Lagi</Button>}
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
