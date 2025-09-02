
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, runTransaction } from 'firebase/firestore';
import { Megaphone, Calendar, ThumbsUp, ThumbsDown, ChevronRight, MessageCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const announcementsData: Announcement[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        announcementsData.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          date: data.date.toDate ? data.date.toDate().toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) : data.date,
        });
      });
      setAnnouncements(announcementsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
 const renderAnnouncements = () => {
    if (loading) {
      return (
        <div className="flex space-x-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="min-w-[300px] w-[300px]">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter>
                 <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (announcements.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-10 col-span-full flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p>Belum ada pengumuman.</p>
        </div>
      );
    }

    return (
       <div className="flex space-x-4 overflow-x-auto pb-4 -mx-1 px-1">
        {announcements.map((announcement) => (
            <Card key={announcement.id} className="min-w-[300px] w-[300px] flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                    <CardTitle className="text-base line-clamp-2">{announcement.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">{announcement.content}</p>
                </CardContent>
                <CardFooter className="flex-col items-start gap-3">
                     <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{announcement.date as string}</span>
                    </p>
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => setSelectedAnnouncement(announcement)}>
                        Baca Selengkapnya
                    </Button>
                </CardFooter>
            </Card>
        ))}
       </div>
    );
  };


  return (
    <div>
        {renderAnnouncements()}
        <Dialog open={!!selectedAnnouncement} onOpenChange={(isOpen) => !isOpen && setSelectedAnnouncement(null)}>
            <DialogContent className="w-[90%] sm:max-w-lg rounded-lg p-0 flex flex-col gap-0">
                {selectedAnnouncement && (
                    <>
                        <DialogHeader className="flex flex-row items-center justify-between space-y-0 bg-primary text-primary-foreground p-4 rounded-t-lg">
                            <DialogTitle>Pengumuman</DialogTitle>
                             <DialogClose asChild>
                                <Button type="button" variant="ghost" size="icon" className="text-primary-foreground h-7 w-7">
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Tutup</span>
                                </Button>
                            </DialogClose>
                        </DialogHeader>
                        <div className="p-6 whitespace-pre-wrap min-h-[150px] flex-grow">
                            <p className="text-foreground break-word">{selectedAnnouncement.content}</p>
                        </div>
                        <DialogFooter className="p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:items-center w-full pt-4 border-t">
                             <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSelectedAnnouncement(null)}>Ok</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
