"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Megaphone, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="grid gap-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Pengumuman Komunitas</h1>
      </div>
       {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full mt-2" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardContent>
                </Card>
            ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
            <Card key={announcement.id} className="flex flex-col">
                <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                    <CardTitle className="text-xl">{announcement.title}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{announcement.date as string}</span>
                    </CardDescription>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Megaphone className="h-6 w-6" />
                    </div>
                </div>
                </CardHeader>
                <CardContent className="flex-grow">
                <p className="text-muted-foreground">{announcement.content}</p>
                </CardContent>
            </Card>
            ))}
        </div>
      )}
    </div>
  );
}
