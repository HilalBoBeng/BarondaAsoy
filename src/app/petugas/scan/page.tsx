
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, QrCode, ArrowLeft, Video } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: "environment" } } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing rear camera, trying front camera:', error);
        try {
            // Fallback to any camera if rear camera fails
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (finalError) {
             console.error('Error accessing any camera:', finalError);
             setHasCameraPermission(false);
             toast({
                variant: 'destructive',
                title: 'Akses Kamera Ditolak',
                description: 'Mohon izinkan akses kamera di browser Anda untuk menggunakan fitur ini.',
            });
        }
      }
    };
    getCameraPermission();
  }, [toast]);

  useEffect(() => {
    const processScan = async () => {
        if (!token) {
            setError('Token absensi tidak ditemukan di URL. Silakan pindai QR code yang benar.');
            setIsProcessing(false);
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing delay
            
            const schedulesRef = collection(db, 'schedules');
            const q = query(schedulesRef, where("qrToken", "==", token));
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
                qrToken: null, // Consume the token
                qrTokenExpires: null,
            });
            
            toast({ title: 'Absen Berhasil', description: 'Status patroli Anda telah diperbarui.' });
            router.push('/petugas');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal memulai patroli.';
            setError(errorMessage);
            toast({ variant: 'destructive', title: 'Gagal', description: errorMessage });
            setIsProcessing(false);
        }
    };
    
    if (hasCameraPermission) {
        processScan();
    }
  }, [token, hasCameraPermission, toast, router]);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Memproses Absensi Anda</CardTitle>
          <CardDescription>
            Harap tunggu, sistem sedang memvalidasi kode absensi Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-square w-full bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden">
            {hasCameraPermission === null && <Loader2 className="h-8 w-8 animate-spin text-white" />}
            
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

            {hasCameraPermission === false && (
                <Alert variant="destructive" className="m-4">
                    <AlertTitle>Kamera Tidak Diizinkan</AlertTitle>
                    <AlertDescription>
                        Mohon izinkan akses kamera di browser Anda untuk menggunakan fitur ini.
                    </AlertDescription>
                </Alert>
            )}
          </div>
          {isProcessing && (
             <div className="flex items-center justify-center p-4 rounded-md bg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">Memvalidasi token...</p>
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
