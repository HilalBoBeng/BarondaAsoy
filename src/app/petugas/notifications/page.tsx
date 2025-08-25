
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification, Announcement } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Bell, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';


export default function PetugasNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [loadingAnns, setLoadingAnns] = useState(true);
  const [petugasId, setPetugasId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Notification | Announcement | null>(null);
  const [itemType, setItemType] = useState<'notification' | 'announcement' | null>(null);

  useEffect(() => {
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.id) {
        setPetugasId(staffInfo.id);
    } else {
        // Handle case where staff info is not available, maybe redirect
    }

    if (staffInfo.id) {
      const notifsQuery = query(
          collection(db, "notifications"),
          where("userId", "in", [staffInfo.id, "all_staff"]),
          orderBy("createdAt", "desc"),
          limit(20)
      );
      const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
          const notifsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
          setNotifications(notifsData);
          setLoadingNotifs(false);
      });

      // Listener for announcements targeted to staff or all
       const annsQuery = query(
          collection(db, "announcements"),
          orderBy("date", "desc"),
          limit(10)
      );
       const unsubAnns = onSnapshot(annsQuery, (snapshot) => {
          const annsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[];
          setAnnouncements(annsData);
          setLoadingAnns(false);
      }, (error) => {
          console.error("Error fetching announcements:", error);
          setLoadingAnns(false);
      });

      return () => {
          unsubNotifs();
          unsubAnns();
      };
    }
  }, []);

  const handleItemClick = async (item: Notification | Announcement, type: 'notification' | 'announcement') => {
    setSelectedItem(item);
    setItemType(type);
    if (type === 'notification' && !(item as Notification).read) {
        const docRef = doc(db, 'notifications', item.id);
        await updateDoc(docRef, { read: true });
    }
  };

  const NotificationCard = ({ notif }: { notif: Notification }) => (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${!notif.read ? 'border-primary' : ''}`} onClick={() => handleItemClick(notif, 'notification')}>
        <CardContent className="p-4">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-grow">
                    <p className="font-bold">{notif.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}
                    </p>
                </div>
                {!notif.read && (
                    <Badge variant="default">Baru</Badge>
                )}
            </div>
        </CardContent>
    </Card>
  )

  const AnnouncementCard = ({ ann }: { ann: Announcement }) => (
     <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => handleItemClick(ann, 'announcement')}>
        <CardContent className="p-4">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    <Megaphone className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-grow">
                    <p className="font-bold">{ann.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{ann.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                         {ann.date ? formatDistanceToNow((ann.date as Timestamp).toDate(), { addSuffix: true, locale: id }) : ''}
                    </p>
                </div>
            </div>
        </CardContent>
    </Card>
  )

  return (
    <>
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Pemberitahuan & Pengumuman</CardTitle>
                <CardDescription>Pesan dan informasi penting untuk Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {loadingNotifs || loadingAnns ? (
                     Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                ) : [...notifications, ...announcements]
                    .sort((a,b) => {
                        const dateA = (a.createdAt || (a as Announcement).date) as Timestamp;
                        const dateB = (b.createdAt || (b as Announcement).date) as Timestamp;
                        return dateB.toMillis() - dateA.toMillis();
                    })
                    .map(item => 'createdAt' in item ? <NotificationCard key={item.id} notif={item as Notification} /> : <AnnouncementCard key={item.id} ann={item as Announcement} />)
                }
                {(!loadingNotifs && !loadingAnns && notifications.length === 0 && announcements.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">Tidak ada pemberitahuan atau pengumuman baru.</p>
                )}
            </CardContent>
        </Card>
    </div>
    
    <Dialog open={!!selectedItem} onOpenChange={(isOpen) => !isOpen && setSelectedItem(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{selectedItem?.title}</DialogTitle>
                <DialogDescription>
                    {itemType === 'notification' && selectedItem?.createdAt ? 
                        new Date((selectedItem.createdAt as Timestamp).toDate()).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : 
                    itemType === 'announcement' && (selectedItem as Announcement).date ? 
                        new Date(((selectedItem as Announcement).date as Timestamp).toDate()).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : ''}
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 whitespace-pre-wrap break-words">
                <p>{itemType === 'notification' ? (selectedItem as Notification)?.message : (selectedItem as Announcement)?.content}</p>
            </div>
            <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Tutup
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
