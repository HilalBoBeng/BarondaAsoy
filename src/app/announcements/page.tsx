
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import type { Announcement } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowLeft, Megaphone, Calendar, Home, UserCircle, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/chat", icon: MessageSquare, label: "Pesan" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
];


export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        return {
          id: doc.id,
          ...docData,
          date: docData.date instanceof Timestamp ? docData.date.toDate() : docData.date,
        } as Announcement;
      });
      setAnnouncements(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenDrawer = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
  };

  return (
    <div className="flex h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            <h1 className="text-lg font-semibold">Pengumuman</h1>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-20 animate-fade-in-up">
            <div className="mx-auto w-full max-w-screen-2xl space-y-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
                ) : announcements.length > 0 ? (
                    announcements.map((ann) => (
                        <Card key={ann.id} className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleOpenDrawer(ann)}>
                            <CardHeader>
                                <CardTitle className="text-base">{ann.title}</CardTitle>
                                <CardDescription className="flex items-center gap-1 text-xs pt-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{ann.date instanceof Date ? format(ann.date, 'PPP', { locale: id }) : 'N/A'}</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-24 text-muted-foreground">
                        <Megaphone className="mx-auto h-12 w-12" />
                        <p className="mt-4">Belum ada pengumuman.</p>
                    </div>
                )}
            </div>
        </main>
        
         <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-4 items-center justify-center gap-2 px-2">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            pathname === item.href ? "text-primary bg-primary/10" : "text-muted-foreground"
                            )}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </Button>
                    </Link>
                ))}
            </div>
        </nav>

        <Drawer open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
            <DrawerContent>
                {selectedAnnouncement && (
                    <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader className="text-left">
                        <DrawerTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5 text-primary" />
                            <span>{selectedAnnouncement.title}</span>
                        </DrawerTitle>
                        <DrawerDescription className="flex items-center gap-2 text-xs pt-1">
                           <Calendar className="h-4 w-4" />
                           <span>{selectedAnnouncement.date instanceof Date ? format(selectedAnnouncement.date, 'PPP', { locale: id }) : 'N/A'}</span>
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pt-0">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedAnnouncement.content}</p>
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                        <Button>Tutup</Button>
                        </DrawerClose>
                    </DrawerFooter>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    </div>
  );
}
