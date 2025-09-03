
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DownloadPage() {
  const [appInfo, setAppInfo] = useState<{ name: string, logoUrl: string, downloadLink: string | null }>({ name: 'Baronda', logoUrl: 'https://iili.io/KJ4aGxp.png', downloadLink: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppInfo({
            name: data.appName || 'Baronda',
            logoUrl: data.appLogoUrl || 'https://iili.io/KJ4aGxp.png',
            downloadLink: data.appDownloadLink || null,
          });
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            {loading ? <Skeleton className="h-24 w-24 rounded-full mx-auto" /> : (
                <Image 
                    src={appInfo.logoUrl}
                    alt="Logo Aplikasi"
                    width={100}
                    height={100}
                    className="mx-auto h-24 w-auto"
                />
            )}
            <CardTitle className="mt-4">
                {loading ? <Skeleton className="h-8 w-40 mx-auto" /> : `Unduh ${appInfo.name}`}
            </CardTitle>
             <CardDescription>
                {loading ? <Skeleton className="h-4 w-60 mx-auto" /> : 'Klik tombol di bawah untuk mengunduh file APK.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                <Skeleton className="h-12 w-full" />
            ) : appInfo.downloadLink ? (
                <Button className="w-full" asChild>
                    <a href={appInfo.downloadLink} download>
                        <Download className="mr-2 h-5 w-5" /> Unduh APK Sekarang
                    </a>
                </Button>
            ) : (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Tautan Tidak Tersedia</AlertTitle>
                    <AlertDescription>
                        Maaf, tautan unduhan untuk aplikasi ini belum tersedia.
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
