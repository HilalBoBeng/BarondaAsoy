
"use client";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PT_Sans } from 'next/font/google';
import { useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import MaintenancePage from "@/app/maintenance/page";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MonitorSmartphone, Smartphone } from "lucide-react";

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

function DesktopBlocker() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-center p-4">
            <Smartphone className="h-16 w-16 text-primary mb-6" />
            <h1 className="text-2xl font-bold text-foreground">Aplikasi Ini Dirancang untuk Seluler</h1>
            <p className="mt-2 max-w-md text-muted-foreground">
                Untuk pengalaman terbaik, silakan buka aplikasi ini di perangkat seluler Anda atau gunakan mode seluler di browser Anda.
            </p>
        </div>
    )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
  
  if (maintenanceMode === null || !isClient) {
      return (
        <html lang="id">
           <head>
              <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
              <link rel="icon" href="https://iili.io/KJ4aGxp.png" type="image/png" />
              <meta name="theme-color" content="#2C3E50" />
           </head>
           <body className={`${ptSans.className} antialiased bg-background overflow-x-hidden no-scrollbar`}>
                <LoadingSkeleton />
           </body>
        </html>
      )
  }
  
  if (!isMobile) {
       return (
         <html lang="id">
           <head>
              <title>Baronda - Mode Seluler</title>
              <meta name="description" content="Aplikasi siskamling untuk keamanan lingkungan Anda." />
              <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
              <link rel="icon" href="https://iili.io/KJ4aGxp.png" type="image/png" />
              <meta name="theme-color" content="#2C3E50" />
           </head>
            <body className={`${ptSans.className} antialiased bg-background overflow-x-hidden no-scrollbar`}>
                <DesktopBlocker />
           </body>
        </html>
       )
  }

  if (maintenanceMode) {
    return (
      <html lang="id">
         <head>
          <title>Baronda - Siskamling Digital</title>
          <meta name="description" content="Aplikasi siskamling untuk keamanan lingkungan Anda." />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <link rel="icon" href="https://iili.io/KJ4aGxp.png" type="image/png" />
          <meta name="theme-color" content="#2C3E50" />
         </head>
        <body className={`${ptSans.className} antialiased bg-background overflow-x-hidden no-scrollbar`}>
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
           <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <link rel="icon" href="https://iili.io/KJ4aGxp.png" type="image/png" />
          <meta name="theme-color" content="#2C3E50" />
      </head>
      <body className={`${ptSans.className} antialiased bg-background overflow-x-hidden no-scrollbar`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
