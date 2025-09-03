
"use client";

import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { PT_Sans } from 'next/font/google';
import { useEffect, useState, type ReactNode, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
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

function App({ children }: { children: ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists() && docSnap.data().maintenanceMode) {
          setMaintenanceMode(true);
        } else {
          setMaintenanceMode(false);
        }
      } catch (error) {
        console.error("Error fetching maintenance status:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);
  
  const isBypassRoute = 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/petugas') || 
    pathname.startsWith('/auth/staff');

  useEffect(() => {
    if (!loading && maintenanceMode && !isBypassRoute) {
      router.push('/maintenance');
    }
  }, [loading, maintenanceMode, isBypassRoute, pathname, router]);


  if (loading) {
    return <LoadingSkeleton />;
  }
  
  if (maintenanceMode && !isBypassRoute) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
          <title>Baronda - Siskamling Digital</title>
          <meta name="description" content="Aplikasi siskamling untuk keamanan lingkungan Anda." />
          <link rel="icon" href="https://iili.io/KJ4aGxp.png" />
      </head>
      <body className={`${ptSans.className} antialiased bg-background`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
          <Suspense fallback={<LoadingSkeleton />}>
            <App>
              {children}
            </App>
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
