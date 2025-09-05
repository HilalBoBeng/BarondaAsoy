
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <header className="absolute top-0 left-0 w-full p-4">
            <Link href="/auth/staff-login" className="flex items-center gap-2">
                <Image 
                    src="https://iili.io/KJ4aGxp.png" 
                    alt="Baronda Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                />
                <span className="font-bold text-primary">Baronda</span>
            </Link>
        </header>
      <div className="w-full max-w-md space-y-6 pt-16 sm:pt-0">
        {children}
      </div>
    </div>
  );
}
