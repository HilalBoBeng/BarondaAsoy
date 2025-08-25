
"use client";

import Link from "next/link";
import {
  Bell,
  Home,
  LogOut,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarondaLogo } from "@/components/icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function PetugasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'petugas') {
      router.replace('/auth/staff-login');
       toast({
        variant: "destructive",
        title: "Akses Ditolak",
        description: "Anda harus masuk sebagai petugas untuk mengakses halaman ini.",
      });
    }
  }, [router, toast]);

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    toast({ title: "Berhasil Keluar", description: "Anda telah keluar." });
    router.push('/auth/staff-login');
  };

  const navItems = [
    { href: "/petugas", icon: Home, label: "Dasbor" },
    { href: "/petugas/reports", icon: ShieldAlert, label: "Laporan" },
    { href: "/petugas/schedule", icon: Calendar, label: "Jadwal Saya" },
  ];

  if (!isClient) {
    return null;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/petugas" className="flex items-center gap-2 font-semibold">
              <BarondaLogo className="h-6 w-6" />
              <span className="">Dasbor Petugas</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    (pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/petugas')) && "bg-muted text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4">
             <Button size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <div className="w-full flex-1">
             <h1 className="text-lg font-semibold md:text-2xl">
              {navItems.find(item => pathname === item.href || pathname.startsWith(item.href + '/'))?.label || 'Dasbor Petugas'}
            </h1>
          </div>
           <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Toggle notifications</span>
            </Button>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
