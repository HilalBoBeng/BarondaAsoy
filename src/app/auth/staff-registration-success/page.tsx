
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from "next/image";
import { CheckCircle } from "lucide-react";

export default function StaffRegistrationSuccessPage() {
  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <Image src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" width={100} height={100} className="h-24 w-auto" />
        <h1 className="text-3xl font-bold text-primary mt-2">Baronda</h1>
        <p className="text-sm text-muted-foreground">Kelurahan Kilongan</p>
      </div>
      <Card>
        <CardHeader className="items-center text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <CardTitle>Pendaftaran Terkirim!</CardTitle>
          <CardDescription>
            Pendaftaran Anda telah berhasil dikirim dan menunggu persetujuan dari Admin. Silakan periksa email Anda secara berkala untuk pembaruan status dan kode akses Anda.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/auth/staff-login">Kembali ke Halaman Masuk</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
