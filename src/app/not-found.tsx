
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4 overflow-hidden">
      <div className="relative mb-8">
         <Image
          src="https://iili.io/KJ4aGxp.png"
          alt="Baronda Logo"
          width={150}
          height={150}
          className="relative z-10 animate-logo-pulse"
        />
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-full bg-primary/5 animate-ping"></div>
        </div>
      </div>
      <div className="animate-fade-in-up">
        <h1 className="text-6xl font-extrabold tracking-tighter text-primary">
            404
        </h1>
        <p className="mt-4 text-2xl font-semibold text-foreground">
            Halaman Tidak Ditemukan
        </p>
      </div>
      <p className="mt-2 max-w-md text-muted-foreground animate-fade-in-up [animation-delay:200ms]">
        Maaf, halaman yang Anda cari tidak ada atau mungkin telah dipindahkan.
      </p>
      <Button asChild className="mt-8 animate-fade-in-up [animation-delay:400ms]">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" />
          Kembali ke Halaman Utama
        </Link>
      </Button>
    </div>
  );
}
