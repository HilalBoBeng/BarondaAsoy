
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


export default function PetugasNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [loadingAnns, setLoadingAnns] = useState(true);
  const [petugasId, setPetugasId] = useState<string | null>(null); // Replace with actual staff ID from auth

  useEffect(() => {
    // This should be replaced with actual staff ID from an auth context
    const currentPetugasId = "petugas_1"; // Placeholder
    setPetugasId(currentPetugasId);

    // Listener for specific notifications to this officer
    const notifsQuery = query(
        collection(db, "notifications"),
        where("userId", "in", [currentPetugasId, "all_staff"]),
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
        where("target", "in", ["all", "staff"]),
        limit(10)
    );
     const unsubAnns = onSnapshot(annsQuery, (snapshot) => {
        const annsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[];
        // Sort client-side
        annsData.sort((a,b) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis());
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
  }, []);

  const markAsRead = async (notifId: string) => {
    const docRef = doc(db, 'notifications', notifId);
    await updateDoc(docRef, { read: true });
  }

  const NotificationCard = ({ notif }: { notif: Notification }) => (
    <Card className={!notif.read ? 'border-primary' : ''}>
        <CardContent className="p-4">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-grow">
                    <p className="font-bold">{notif.title}</p>
                    <p className="text-sm text-muted-foreground">{notif.message.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}
                    </p>
                </div>
                {!notif.read && (
                    <Badge variant="default" className="cursor-pointer" onClick={() => markAsRead(notif.id)}>Baru</Badge>
                )}
            </div>
        </CardContent>
    </Card>
  )

  const AnnouncementCard = ({ ann }: { ann: Announcement }) => (
     <Card>
        <CardContent className="p-4">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    <Megaphone className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-grow">
                    <p className="font-bold">{ann.title}</p>
                    <p className="text-sm text-muted-foreground">{ann.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                         {ann.date ? formatDistanceToNow((ann.date as any).toDate(), { addSuffix: true, locale: id }) : ''}
                    </p>
                </div>
                <Badge variant="secondary">{ann.target === 'all' ? 'Publik' : 'Untuk Staf'}</Badge>
            </div>
        </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Pemberitahuan Tugas</CardTitle>
                <CardDescription>Pesan dan instruksi penting dari admin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {loadingNotifs ? (
                     Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                ) : notifications.length > 0 ? (
                    notifications.map(notif => <NotificationCard key={notif.id} notif={notif} />)
                ) : (
                    <p className="text-muted-foreground text-center py-4">Tidak ada pemberitahuan baru.</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Pengumuman</CardTitle>
                <CardDescription>Pengumuman umum terkait jadwal atau informasi lainnya.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {loadingAnns ? (
                     Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                ) : announcements.length > 0 ? (
                    announcements.map(ann => <AnnouncementCard key={ann.id} ann={ann} />)
                ) : (
                    <p className="text-muted-foreground text-center py-4">Tidak ada pengumuman.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
