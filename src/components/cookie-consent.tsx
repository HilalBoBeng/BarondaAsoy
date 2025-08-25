"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';

const COOKIE_CONSENT_KEY = 'baronda_cookie_consent';

type ConsentValue = 'accepted' | 'rejected' | null;

export default function CookieConsent() {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedConsent = Cookies.get(COOKIE_CONSENT_KEY) as ConsentValue | undefined;
    if (storedConsent === 'accepted' || storedConsent === 'rejected') {
      setConsent(storedConsent);
    }
  }, []);

  const handleConsent = (value: 'accepted' | 'rejected') => {
    Cookies.set(COOKIE_CONSENT_KEY, value, { expires: 365 });
    setConsent(value);
  };

  if (!isMounted || consent) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-slide-in-up">
      <Card className="max-w-4xl mx-auto shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            <span>Pemberitahuan Cookie</span>
          </CardTitle>
          <CardDescription>
            Kami menggunakan cookie untuk memastikan Anda mendapatkan pengalaman terbaik di situs web kami. Cookie ini penting untuk fungsionalitas dasar dan untuk menganalisis lalu lintas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsPreferencesOpen(true)}>
              Preferensi
            </Button>
            <Button variant="secondary" onClick={() => handleConsent('rejected')}>
              Tolak Semua
            </Button>
            <Button onClick={() => handleConsent('accepted')}>
              Terima Semua
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preferensi Cookie</DialogTitle>
            <DialogDescription>
              Kelola pengaturan cookie Anda. Cookie yang sangat penting tidak dapat dinonaktifkan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="essential-cookies" className="font-bold">Cookie Esensial</Label>
              <Switch id="essential-cookies" checked disabled />
            </div>
             <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="analytics-cookies" className="font-bold">Cookie Analitik</Label>
              <Switch id="analytics-cookies" defaultChecked />
            </div>
             <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="marketing-cookies" className="font-bold">Cookie Pemasaran</Label>
              <Switch id="marketing-cookies" />
            </div>
          </div>
          <DialogFooter>
             <DialogClose asChild>
                <Button variant="secondary">Batal</Button>
            </DialogClose>
            <Button onClick={() => {
                handleConsent('accepted');
                setIsPreferencesOpen(false);
            }}>
                Simpan Preferensi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
