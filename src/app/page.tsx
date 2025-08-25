
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ReportActivity from '@/components/dashboard/report-activity';
import Schedule from '@/components/dashboard/schedule';
import Announcements from "@/components/dashboard/announcements";
import EmergencyContacts from "@/components/dashboard/emergency-contacts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="https://iili.io/KJ4aGxp.png" 
              alt="Logo" 
              width={40} 
              height={40}
              className="h-10 w-10"
            />
            <div>
              <span className="text-lg font-bold text-primary">Baronda</span>
              <p className="text-xs text-muted-foreground">Kelurahan Kilongan</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" asChild>
                <Link href="/auth/login">
                    Masuk
                </Link>
           </Button>
           <Button asChild>
                <Link href="/auth/register">
                    Daftar
                </Link>
           </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Selamat Datang di Siskamling Digital</h1>
            <p className="text-muted-foreground">Sistem Keamanan Lingkungan berbasis digital untuk lingkungan yang lebih aman.</p>
          </div>

          <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Pengumuman</CardTitle>
                </CardHeader>
                <CardContent>
                    <Announcements />
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lapor Aktivitas</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportActivity />
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Jadwal Patroli</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[500px] overflow-auto">
                        <Schedule />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Kontak Darurat</CardTitle>
                </CardHeader>
                <CardContent>
                    <EmergencyContacts />
                </CardContent>
            </Card>

          </div>
        </div>
      </main>
      <footer className="border-t bg-background py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Baronda - Siskamling Digital Kelurahan Kilongan.
      </footer>
    </div>
  );
}
