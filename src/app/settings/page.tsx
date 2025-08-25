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
import { Moon, Sun } from "lucide-react"
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
        <main className="flex flex-1 flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
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
        <footer className="border-t bg-background py-4 text-center text-sm text-muted-foreground px-4">
            © {new Date().getFullYear()} Baronda - Siskamling Digital Kelurahan Kilongan.
        </footer>
    </div>
  )
}
