
"use client";

import { useEffect, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { X } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogClose } from '../ui/dialog';
import Image from 'next/image';

interface PopupAnnouncement {
    imageUrl: string;
    updatedAt: Timestamp;
}

export default function WelcomeAnnouncement() {
  const [popupAnnouncement, setPopupAnnouncement] = useState<PopupAnnouncement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const settingsRef = doc(db, 'app_settings', 'popup_announcement');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const announcementData = docSnap.data() as PopupAnnouncement;
        
        const shouldShow = sessionStorage.getItem('showWelcomePopup') === 'true';

        if (shouldShow && announcementData.imageUrl) {
            setPopupAnnouncement(announcementData);
            setIsDialogOpen(true);
            sessionStorage.removeItem('showWelcomePopup');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  if (!popupAnnouncement || !popupAnnouncement.imageUrl) {
    return null;
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-md w-[90%] flex items-center justify-center rounded-lg aspect-auto">
        {popupAnnouncement.imageUrl && (
            <div className="relative w-full h-full">
               <Image
                   src={popupAnnouncement.imageUrl}
                   alt="Pengumuman"
                   layout="responsive"
                   width={16}
                   height={9}
                   objectFit="contain"
                   className="rounded-lg"
               />
                <DialogClose asChild>
                    <Button size="icon" variant="secondary" className="absolute top-2 right-2 rounded-full h-8 w-8 z-10">
                        <X className="h-4 w-4" />
                    </Button>
                </DialogClose>
            </div>
         )}
      </DialogContent>
    </Dialog>
  );
}
