
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 pt-16 sm:pt-0">
        {children}
      </div>
    </div>
  );
}
