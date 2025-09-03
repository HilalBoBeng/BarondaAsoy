
"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from "next/navigation";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";
import MaintenancePage from "./maintenance/page";
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
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
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

    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            setMaintenanceMode(docSnap.data().maintenanceMode);
        } else {
            // If the settings doc doesn't exist, assume maintenance is off
            setMaintenanceMode(false);
        }
      } catch (error) {
        console.error("Error fetching maintenance status:", error);
        setMaintenanceMode(false);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [router]);

  if (loading || maintenanceMode === null) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      {maintenanceMode ? <MaintenancePage /> : <MainDashboardView />}
    </>
  );
}
