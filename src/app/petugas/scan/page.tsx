
"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp, serverTimestamp, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, QrCode, CheckCircle, ShieldAlert, Image as ImageIcon, CameraOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'permission_denied'>('idle');
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

  useEffect(() => {
    // Only initialize the scanner once
    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader-container");
    }

    const startCamera = async () => {
      setStatus('idle');
      try {
        await Html5Qrcode.getCameras();
        setStatus('scanning');
        scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
              setScanResult(decodedText);
            }
          },
          (errorMessage) => {
            // console.warn(`QR error: ${errorMessage}`);
          }
        ).catch(err => {
            console.error("Camera start failed:", err);
            setErrorMessage("Gagal memulai kamera. Pastikan izin telah diberikan.");
            setStatus('permission_denied');
        });
      } catch (err) {
        setErrorMessage("Tidak dapat menemukan kamera atau izin ditolak.");
        setStatus('permission_denied');
      }
    };
    
    if (scanType && scannerRef.current && !scannerRef.current.isScanning) {
        startCamera();
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner:", err));
      }
    };
  }, [scanType]);

  useEffect(() => {
    if (scanResult) {
      processDecodedText(scanResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanResult]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('processing');
    try {
        const decodedText = await scannerRef.current?.scanFile(file, false);
        if (decodedText) {
            setScanResult(decodedText);
        } else {
            throw new Error("Tidak dapat menemukan QR code pada gambar.");
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memproses gambar.';
        setErrorMessage(msg);
        setStatus('error');
        setTimeout(() => setStatus('scanning'), 2000);
    }
  };

  const processDecodedText = async (decodedText: string | null | undefined) => {
    if (!decodedText || status === 'processing' || status === 'success') return;
    
    setStatus('processing');
    setErrorMessage(null);
    
    if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
    }
    
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
            return (
                 <div className="p-6 text-center space-y-4">
                    <CameraOff className="h-12 w-12 text-destructive mx-auto"/>
                    <h3 className="text-lg font-semibold">Akses Kamera Diperlukan</h3>
                    <p className="text-sm text-muted-foreground">{errorMessage}</p>
                    <p className="text-xs text-muted-foreground">Mohon izinkan akses kamera pada pengaturan browser Anda, lalu coba lagi.</p>
                 </div>
            )
        default:
            return (
                <CardContent className="space-y-4">
                    <div className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden shadow-inner flex items-center justify-center">
                        <div id="qr-reader-container" className="w-full h-full" />
                        {status === 'processing' && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>Memvalidasi...</p>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-3 right-3 z-10 bg-black/30 text-white hover:bg-black/50"
                            onClick={() => fileInputRef.current?.click()}
                            title="Unggah dari Galeri"
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                    </div>
                    {status === 'error' && errorMessage && (
                         <Alert variant="destructive">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Gagal Memindai</AlertTitle>
                            <AlertDescription>
                                {errorMessage}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            )
    }
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
        {renderContent()}
        <CardContent>
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
