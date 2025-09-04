
"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

export default function HomePage() {
  const auth = getAuth(app);
  const router = useRouter();

  useEffect(() => {
    // Redirect staff/admin away from the user homepage
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      router.replace('/admin');
      return;
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
      return;
    }
  }, [router]);

  return <MainDashboardView />;
}
