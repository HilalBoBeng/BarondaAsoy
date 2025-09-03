
'use client';

import Image from 'next/image';

export default function MaintenancePage() {
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
        <h1 className="text-4xl font-extrabold tracking-tighter text-primary">
            Segera Kembali
        </h1>
        <p className="mt-4 text-xl font-semibold text-foreground">
            Aplikasi Sedang dalam Pemeliharaan
        </p>
      </div>
      <p className="mt-2 max-w-md text-muted-foreground animate-fade-in-up [animation-delay:200ms]">
        Kami sedang melakukan beberapa perbaikan untuk meningkatkan pengalaman Anda. Mohon kembali lagi nanti.
      </p>
    </div>
  );
}
