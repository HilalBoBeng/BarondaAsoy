
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function StaffRegistrationSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto mb-4" />
        <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
        <h1 className="text-2xl font-bold text-foreground">Pendaftaran Terkirim!</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
            Pendaftaran Anda telah berhasil dikirim dan menunggu persetujuan dari Admin. Silakan periksa email Anda secara berkala untuk pembaruan status dan kode akses Anda.
        </p>
        <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground">
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             Anda akan dialihkan secara otomatis...
        </div>
    </div>
  );
}
