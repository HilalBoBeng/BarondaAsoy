
"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import type { Notification, AppUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";
import MaintenancePage from "./maintenance/page";

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
        const docSnap = await getDocs(settingsRef);
        if (docSnap.docs.length > 0) {
            setMaintenanceMode(docSnap.docs[0].data().maintenanceMode);
        } else {
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
    return null; // Or a loading skeleton for the whole page
  }

  return (
    <>
      {maintenanceMode ? <MaintenancePage /> : <MainDashboardView />}
    </>
  );
}
