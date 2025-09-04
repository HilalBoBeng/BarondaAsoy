'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="flex h-full items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle>Akses Ditolak</CardTitle>
          <CardDescription>
            Menu ini tidak dapat Anda akses karena telah dikunci atau disembunyikan oleh Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Mengalihkan Anda kembali ke dasbor dalam {countdown} detik...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
