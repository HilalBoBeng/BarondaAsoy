
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Megaphone, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import type { Announcement } from '@/lib/types';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '../ui/drawer';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Announcements() {
  const [latestAnnouncement, setLatestAnnouncement] = useState<Announcement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        const announcementData = {
          id: doc.id,
          title: data.title,
          content: data.content,
          date: data.date.toDate ? data.date.toDate() : data.date,
        } as Announcement;

        // Automatically open drawer for new announcement, but only once per session
        const hasBeenShown = sessionStorage.getItem(`announcement_${doc.id}`);
        if (!hasBeenShown) {
          setLatestAnnouncement(announcementData);
          setIsDrawerOpen(true);
          sessionStorage.setItem(`announcement_${doc.id}`, 'true');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  if (!latestAnnouncement) {
    return null;
  }

  return (
    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <span>{latestAnnouncement.title}</span>
            </DrawerTitle>
            <DrawerDescription className="flex items-center gap-2 text-xs pt-1">
               <Calendar className="h-4 w-4" />
               <span>{latestAnnouncement.date instanceof Date ? format(latestAnnouncement.date, 'PPP', { locale: id }) : 'N/A'}</span>
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pt-0">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {latestAnnouncement.content}
            </p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>Saya Mengerti</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
