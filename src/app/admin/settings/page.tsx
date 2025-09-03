
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminSettingsPage() {
  const firebaseProjectUrl = "https://console.firebase.google.com/project/siskamling-digital/appdistribution";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Rilis Aplikasi</CardTitle>
        <CardDescription>
          Rilis aplikasi sekarang dikelola melalui Firebase App Distribution untuk alur kerja yang lebih baik.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <UploadCloud className="h-4 w-4" />
          <AlertTitle>Alur Kerja Baru</AlertTitle>
          <AlertDescription>
            Fitur unggah APK manual dari halaman ini telah dinonaktifkan. Silakan gunakan dasbor Firebase App Distribution untuk mengunggah dan mendistribusikan versi baru aplikasi Anda.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 p-4 border rounded-lg">
            <h3 className="font-semibold">Langkah-langkah Merilis Versi Baru:</h3>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Buka Dasbor Firebase App Distribution.</li>
                <li>Pilih aplikasi Baronda Anda.</li>
                <li>Seret dan lepas (drag-and-drop) file APK baru Anda ke area unggah.</li>
                <li>Tambahkan catatan rilis dan distribusikan ke grup penguji atau rilis tautan publik.</li>
            </ol>
        </div>

        <Button asChild>
          <Link href={firebaseProjectUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Buka Firebase App Distribution
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
