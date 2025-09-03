
"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

interface LinkData {
  longUrl: string;
}

export default function GoPage({ params }: { params: { slug: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Mempersiapkan tautan aman Anda...');
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.slug) {
      const fetchLink = async () => {
        try {
          const q = query(
              collection(db, 'shortlinks'), 
              where('slug', '==', params.slug),
              limit(1)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data() as LinkData;
            setDestinationUrl(data.longUrl);
            setStatus('success');
            setMessage(`Anda akan diarahkan dalam 3 detik...`);
            
            setTimeout(() => {
              window.location.href = data.longUrl;
            }, 3000);

          } else {
            setStatus('error');
            setMessage('Tautan tidak ditemukan atau sudah tidak valid.');
          }
        } catch (error) {
          console.error("Error fetching link:", error);
          setStatus('error');
          setMessage('Terjadi kesalahan saat memproses tautan.');
        }
      };

      fetchLink();
    }
  }, [params.slug]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg text-center overflow-hidden">
        <CardHeader className="bg-background p-8">
           <div className="relative mb-4 w-24 h-24 mx-auto">
             <Image
              src="https://iili.io/KJ4aGxp.png"
              alt="Baronda Logo"
              width={100}
              height={100}
              className="relative z-10 animate-logo-pulse"
            />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-28 w-28 rounded-full bg-primary/10 animate-ping"></div>
            </div>
          </div>
          <CardTitle>
            {status === 'loading' && 'Mengarahkan...'}
            {status === 'success' && 'Pengalihan Dalam Proses'}
            {status === 'error' && 'Tautan Tidak Valid'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground truncate max-w-full">
                Ke: <a href={destinationUrl!} className="text-primary hover:underline">{destinationUrl}</a>
              </p>
              <Button variant="outline" asChild>
                <a href={destinationUrl!}>Klik di sini jika tidak diarahkan</a>
              </Button>
            </div>
          )}
          {status === 'error' && (
            <Button asChild>
              <Link href="/">Kembali ke Halaman Utama</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
