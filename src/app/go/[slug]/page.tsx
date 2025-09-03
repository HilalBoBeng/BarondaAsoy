
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface LinkData {
  longUrl: string;
}

export default function GoPage({ params }: { params: { slug: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Sedang mencari tautan...');
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.slug) {
      const fetchLink = async () => {
        try {
          const docRef = doc(db, 'shortlinks', params.slug);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as LinkData;
            setDestinationUrl(data.longUrl);
            setStatus('success');
            setMessage(`Anda akan diarahkan ke: ${data.longUrl}`);
            
            // Redirect after 3 seconds
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
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>
            {status === 'loading' && 'Mengarahkan...'}
            {status === 'success' && 'Pengalihan Dalam Proses'}
            {status === 'error' && 'Tautan Tidak Valid'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Harap tunggu...</p>
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
