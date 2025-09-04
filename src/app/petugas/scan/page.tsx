
"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp, serverTimestamp, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, CheckCircle, ShieldAlert, CameraOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode, Html5QrcodeResult } from 'html5-qrcode';
import { cn } from '@/lib/utils';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrReaderContainerId = "qr-reader-container";
  const requestRef = useRef<number>();
  
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'permission_denied'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    const type = searchParams.get('type') as 'start' | 'end';
    if (type) {
      setScanType(type);
    } else {
      setErrorMessage("Tipe pemindaian tidak valid.");
      setStatus('error');
    }
  }, [searchParams]);

  const onScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
    if (status === 'scanning') { // Only process if we are actively scanning
      setStatus('success'); // Immediately go to success state visually
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop();
      }
      processDecodedText(decodedText);
    }
  };
  
  const onScanFailure = (error: any) => {
    // This can be verbose, so we don't show toast for every failure.
  };

  useEffect(() => {
    if (scanType && status === 'idle') {
      const html5QrcodeScanner = new Html5Qrcode(qrReaderContainerId, {
          // verbose: true
      });
      scannerRef.current = html5QrcodeScanner;

      const startScanner = async () => {
          try {
              await html5QrcodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, useBarCodeDetectorIfSupported: true, },
                onScanSuccess,
                onScanFailure
              );
              setStatus('scanning');
          } catch(err) {
              console.error("Camera start failed:", err);
              setErrorMessage("Gagal memulai kamera. Pastikan izin telah diberikan.");
              setStatus('permission_denied');
          }
      };

      // Ensure the container is in the DOM
      requestRef.current = requestAnimationFrame(startScanner);
    }

    return () => {
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
      }
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner:", err));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanType, status]);


  const processDecodedText = async (decodedText: string) => {
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
      toast({ title: 'Absen Berhasil', description: `Status patroli telah diperbarui.` });

      setTimeout(() => {
          router.push('/petugas/schedule');
      }, 2000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses QR code.';
      setErrorMessage(msg);
      setStatus('error');
      // No automatic reset to idle, user must press cancel or retry.
    }
  };

  const renderContent = () => {
    switch (status) {
        case 'success':
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                     <CheckCircle className="h-16 w-16 text-green-500 animate-in fade-in zoom-in-50" />
                     <p className="text-lg font-semibold">Absen Berhasil!</p>
                     <p className="text-muted-foreground">Anda akan dialihkan kembali ke halaman jadwal...</p>
                     <Loader2 className="h-5 w-5 animate-spin" />
                </div>
            );
        case 'permission_denied':
        case 'error':
             return (
                 <div className="p-6 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                        {status === 'permission_denied' ? <CameraOff className="h-7 w-7 text-destructive"/> : <ShieldAlert className="h-7 w-7 text-destructive" />}
                    </div>
                    <h3 className="text-lg font-semibold">Gagal Memindai</h3>
                    <p className="text-sm text-muted-foreground">{errorMessage || "Terjadi kesalahan yang tidak diketahui."}</p>
                 </div>
            )
        default:
            return (
                <CardContent className="space-y-4 p-4">
                    <div className={cn(
                        "relative w-full max-w-sm mx-auto aspect-square rounded-lg overflow-hidden shadow-inner flex items-center justify-center",
                        status === 'idle' ? 'bg-black' : 'bg-muted'
                        )}>
                        <div id={qrReaderContainerId} className={cn("w-full h-full", status === 'idle' && 'opacity-0')} />
                         {status === 'idle' && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>Menyiapkan kamera...</p>
                            </div>
                         )}
                    </div>
                </CardContent>
            )
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Pindai Kode QR</CardTitle>
          <CardDescription>Arahkan kamera ke kode QR untuk {scanType === 'start' ? 'Memulai' : 'Mengakhiri'} Patroli.</CardDescription>
        </CardHeader>
        {renderContent()}
        <CardFooter>
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/petugas/schedule">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Batal
            </Link>
          </Button>
        </CardFooter>
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
