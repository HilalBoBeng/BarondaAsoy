
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin' || userRole === 'bendahara') {
      router.replace('/admin');
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
    }
  }, [router]);

  return <MainDashboardView />;
}
