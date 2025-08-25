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

export default function SettingsPage() {
  const { setTheme, theme } = useTheme()

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <div className="w-full max-w-lg p-4">
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
                                Pilih antara mode terang, gelap, atau gunakan pengaturan sistem.
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
                     <Button variant="link" asChild className="p-0">
                        <a href="/">Kembali ke Halaman Utama</a>
                    </Button>
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
