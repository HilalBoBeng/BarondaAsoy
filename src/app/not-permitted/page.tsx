
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';

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
    <div className="flex h-full items-center justify-center p-4 bg-background">
      <div className="text-center space-y-4 max-w-md">
        <ShieldAlert className="h-20 w-20 text-destructive mx-auto animate-pulse" />
        <h1 className="text-3xl font-bold tracking-tight">Akses Ditolak</h1>
        <p className="text-muted-foreground text-lg">
            Menu ini tidak dapat Anda akses karena telah dikunci atau disembunyikan oleh Administrator.
        </p>
        <div className="flex items-center justify-center text-sm text-muted-foreground pt-4">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Anda akan dialihkan ke dasbor dalam {countdown} detik...
        </div>
      </div>
    </div>
  );
}
