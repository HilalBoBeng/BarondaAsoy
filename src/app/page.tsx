
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase/client";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";
import Image from "next/image";
import { cn } from "@/lib/utils";

function LoadingScreen() {
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
    );
}


export default function HomePage() {
  const router = useRouter();
  const auth = getAuth(app);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in.
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'admin' || userRole === 'bendahara') {
          router.replace('/admin');
        } else if (userRole === 'petugas') {
          router.replace('/petugas');
        } else {
           // This is a regular user, stay on the main dashboard view.
           setLoading(false);
        }
      } else {
        // User is signed out.
        router.replace('/auth/login');
      }
    });

    return () => unsubscribe();
  }, [auth, router]);
  
  // While checking auth state, show a loading screen.
  if (loading) {
      return <LoadingScreen />;
  }

  // Only render dashboard for logged-in regular users.
  return <MainDashboardView />;
}
