
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function NotPermittedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev - 1 <= 0) {
          router.replace('/petugas');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

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
            <div className="h-48 w-48 rounded-full bg-destructive/10 animate-ping"></div>
        </div>
      </div>
      <div className="animate-fade-in-up">
        <h1 className="text-4xl font-extrabold tracking-tight text-destructive flex items-center justify-center gap-3">
            <ShieldAlert className="h-10 w-10"/>
            Akses Ditolak
        </h1>
        <p className="mt-4 text-xl font-semibold text-foreground">
            Menu ini tidak dapat Anda akses.
        </p>
      </div>
      <p className="mt-2 max-w-md text-muted-foreground animate-fade-in-up [animation-delay:200ms]">
        Halaman yang Anda coba buka telah dikunci atau disembunyikan oleh Administrator.
      </p>
       <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground animate-fade-in-up [animation-delay:400ms]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Anda akan dialihkan ke dasbor dalam {countdown} detik...
        </div>
    </div>
  );
}
