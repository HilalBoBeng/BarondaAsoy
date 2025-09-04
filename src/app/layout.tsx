
"use client";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PT_Sans } from 'next/font/google';
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import MaintenancePage from "./maintenance/page";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700']
});

function LoadingSkeleton() {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background")}>
        <Image 
            src="https://iili.io/KJ4aGxp.png" 
            alt="Loading Logo" 
            width={120} 
            height={120} 
            className="animate-logo-pulse"
            priority
        />
    </div>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const settingsRef = doc(db, 'app_settings', 'config');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            setMaintenanceMode(docSnap.data().maintenanceMode);
        } else {
            setMaintenanceMode(false);
        }
    }, (error) => {
        console.error("Error fetching maintenance status:", error);
        setMaintenanceMode(false);
    });

    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (maintenanceMode === null) return;

    const bypassRoutes = ['/auth', '/admin', '/petugas', '/go'];
    const isBypassRoute = bypassRoutes.some(route => pathname.startsWith(route));
    const isMaintenancePage = pathname === '/maintenance';

    if (maintenanceMode && !isBypassRoute && !isMaintenancePage) {
        router.replace('/maintenance');
    }
  }, [maintenanceMode, pathname, router]);
  
  if (maintenanceMode === null) {
      return (
        <html lang="id">
           <body className={`${ptSans.className} antialiased bg-background`}>
                <LoadingSkeleton />
           </body>
        </html>
      )
  }

  if (maintenanceMode && !['/auth', '/admin', '/petugas', '/go', '/maintenance'].some(route => pathname.startsWith(route))) {
    return (
      <html lang="id">
        <body className={`${ptSans.className} antialiased bg-background`}>
          <MaintenancePage />
        </body>
      </html>
    );
  }

  return (
    <html lang="id">
      <head>
          <title>Baronda - Siskamling Digital</title>
          <meta name="description" content="Aplikasi siskamling untuk keamanan lingkungan Anda." />
          <link rel="icon" href="https://iili.io/KJ4aGxp.png" />
      </head>
      <body className={`${ptSans.className} antialiased bg-background`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
