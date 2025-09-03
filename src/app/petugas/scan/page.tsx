
"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp, serverTimestamp, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, Image as ImageIcon, Camera, CheckCircle, ShieldAlert } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult, type Html5QrcodeScannerState } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'permission_denied'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'start' | 'end' | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = "qr-code-full-region";

  useEffect(() => {
    const type = searchParams.get('type') as 'start' | 'end';
    if (type) {
      setScanType(type);
    } else {
      setErrorMessage("Tipe pemindaian tidak valid.");
      setStatus('error');
    }
  }, [searchParams]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(err => {
        console.error("Gagal menghentikan pemindai.", err);
      });
    }
  }, []);
  
  const processDecodedText = useCallback(async (decodedText: string) => {
    if (status === 'processing' || status === 'success') return;
    
    setStatus('processing');
    setErrorMessage(null);
    stopScanner();

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
  }, [status, router, toast, scanType, stopScanner]);

  useEffect(() => {
    if (!scanType || scannerRef.current) return;
    
    const qrScanner = new Html5Qrcode(scannerContainerId, { verbose: false });
    scannerRef.current = qrScanner;

    const onScanSuccess = (decodedText: string, result: Html5QrcodeResult) => {
        if (status !== 'scanning') return;
        processDecodedText(decodedText);
    };

    const onScanFailure = (error: Html5QrcodeError) => {};

    const startCamera = async () => {
        if (!scannerRef.current) return;
        setStatus('idle');
        try {
            await scannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanFailure
            );
            setStatus('scanning');
        } catch (err) {
            console.error("Camera start error:", err);
            const errMessage = (err as any).name === "NotAllowedError" 
                ? "Izin akses kamera ditolak. Mohon aktifkan di pengaturan browser Anda."
                : `Gagal memulai kamera: ${(err as Error).message}`;
            setErrorMessage(errMessage);
            setStatus('permission_denied');
        }
    };
    
    startCamera();

    return () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(err => console.log("Gagal menghentikan pemindai saat cleanup.", err));
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanType]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = ''; // Reset

    if (!scannerRef.current) return;

    stopScanner();
    setStatus('processing');
    setErrorMessage(null);
    try {
      const decodedText = await scannerRef.current.scanFile(file, false);
      processDecodedText(decodedText);
    } catch (err) {
       setErrorMessage("Tidak dapat menemukan QR code pada gambar. Pastikan gambar jelas dan tidak buram.");
       setStatus('error');
    }
  };

  const handleTryAgain = () => {
    setErrorMessage(null);
    setStatus('idle');
    window.location.reload();
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
          <CardTitle>Pindai Kode QR</CardTitle>
          <CardDescription>Arahkan kamera ke kode QR untuk {scanType === 'start' ? 'Memulai' : 'Mengakhiri'} Patroli.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden shadow-inner flex items-center justify-center">
             <div id={scannerContainerId} className="w-full h-full"></div>
            {status === 'idle' && (
                <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Meminta izin kamera...</p>
                </div>
            )}
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Unggah Gambar QR"
            >
                <ImageIcon className="h-5 w-5" />
            </Button>
          </div>
          
           <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />

          {status === 'processing' && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">Memvalidasi token...</p>
             </div>
          )}

          {(status === 'error' || status === 'permission_denied') && errorMessage && (
             <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>
                    {errorMessage}
                    <Button onClick={handleTryAgain} className="mt-2" size="sm" variant="secondary">Coba Lagi</Button>
                </AlertDescription>
            </Alert>
          )}

           <Button variant="secondary" className="w-full" asChild>
                <Link href="/petugas/schedule">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Batal
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
