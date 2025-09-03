
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan</CardTitle>
        <CardDescription>
          Halaman ini sedang dalam perbaikan.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fitur Dinonaktifkan</AlertTitle>
          <AlertDescription>
            Fitur pengaturan admin telah dinonaktifkan untuk sementara waktu.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
