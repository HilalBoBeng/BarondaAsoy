
"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Moon, Sun, Mail } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  const { setTheme, theme } = useTheme()

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
          <h1 className="text-lg sm:text-xl font-bold text-primary">
            Pengaturan
          </h1>
          <Button asChild variant="outline">
            <Link href="/">
              Kembali ke Halaman Utama
            </Link>
          </Button>
       </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
             <div className="mx-auto max-w-2xl">
                <Card>
                    <CardHeader>
                    <CardTitle>Pengaturan Tampilan</CardTitle>
                    <CardDescription>
                        Pilih tema tampilan untuk aplikasi.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <h3 className="font-medium">Tema Aplikasi</h3>
                                <p className="text-sm text-muted-foreground">
                                    Pilih antara mode terang atau gelap.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant={theme === 'light' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("light")}>
                                    <Sun className="h-5 w-5" />
                                    <span className="sr-only">Light</span>
                                </Button>
                                <Button variant={theme === 'dark' ? 'default' : 'outline'} size="icon" onClick={() => setTheme("dark")}>
                                    <Moon className="h-5 w-5" />
                                    <span className="sr-only">Dark</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
        <footer className="border-t bg-background py-6 text-center text-sm text-muted-foreground px-4">
            <div className="space-y-2">
                <p>© {new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.</p>
                <div className="flex justify-center">
                    <a href="mailto:admin@bobeng.icu" className="inline-flex items-center gap-2 text-primary hover:underline">
                        <Mail className="h-4 w-4" />
                        <span>Hubungi Admin</span>
                    </a>
                </div>
            </div>
        </footer>
    </div>
  )
}

    