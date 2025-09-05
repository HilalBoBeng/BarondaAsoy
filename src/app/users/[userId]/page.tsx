
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, setDoc } from 'firebase/firestore';
import { notFound, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppUser, Report, Reply } from '@/lib/types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { getAuth } from 'firebase/auth';

const statusDisplay: Record<string, { text: string; className: string }> = {
  new: { text: 'Baru', className: 'bg-red-100 text-red-800' },
  in_progress: { text: 'Ditangani', className: 'bg-yellow-100 text-yellow-800' },
  resolved: { text: 'Selesai', className: 'bg-green-100 text-green-800' },
};

export default function UserProfilePage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile({ uid: userDoc.id, ...userDoc.data() } as AppUser);

          const reportsQuery = query(
            collection(db, 'reports'),
            where('userId', '==', userId),
            where('visibility', '==', 'public'),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          const reportsSnapshot = await getDocs(reportsQuery);
          const reportsData = reportsSnapshot.docs.map(d => {
              const data = d.data();
              return {
                  id: d.id, ...data,
                  createdAt: data.createdAt.toDate(),
                  replies: Object.values(data.replies || {})
              } as Report
          });
          setReports(reportsData);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);
  
  const handleSendMessage = async () => {
    if (!currentUser || !profile) return;
    
    // Create a unique chat ID
    const chatId = [currentUser.uid, profile.uid].sort().join('_');
    const chatDocRef = doc(db, 'chats', chatId);
    
    try {
      const chatDoc = await getDoc(chatDocRef);
      if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
          users: [currentUser.uid, profile.uid],
          userNames: {
            [currentUser.uid]: currentUser.displayName || 'Warga',
            [profile.uid]: profile.displayName || 'Warga'
          },
          userPhotos: {
            [currentUser.uid]: currentUser.photoURL || '',
            [profile.uid]: profile.photoURL || ''
          },
          lastMessage: null,
        });
      }
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error creating or getting chat:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4"><Skeleton className="h-9 w-24" /></header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="container mx-auto max-w-2xl space-y-6">
            <Card>
              <CardHeader className="items-center text-center p-6 bg-muted/50">
                <Skeleton className="mx-auto h-24 w-24 rounded-full" />
                <Skeleton className="mx-auto mt-4 h-8 w-48" />
                <Skeleton className="mx-auto mt-2 h-4 w-64" />
              </CardHeader>
              <CardContent className="p-6"><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
            <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto max-w-2xl space-y-6">
                <Card className="overflow-hidden">
                    <CardHeader className="items-center text-center p-6 bg-muted/50">
                        <Avatar className="h-24 w-24 border-4">
                            <AvatarImage src={profile.photoURL || undefined} />
                            <AvatarFallback className="text-3xl">{profile.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="mt-4 text-2xl">{profile.displayName}</CardTitle>
                        <CardDescription>{profile.bio || 'Warga Kelurahan Kilongan'}</CardDescription>
                    </CardHeader>
                     <CardContent className="p-6">
                        {currentUser && currentUser.uid !== profile.uid && (
                             <Button className="w-full" onClick={handleSendMessage}>
                                <MessageSquare className="mr-2 h-4 w-4"/> Kirim Pesan
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Riwayat Laporan Publik</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {reports.length > 0 ? (
                             <div className="space-y-4">
                                {reports.map(report => (
                                    <Card key={report.id}>
                                         <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <div className="flex-grow">
                                                     <p className="text-sm text-foreground/90 break-words pr-4">{report.reportText}</p>
                                                     <p className="text-xs text-muted-foreground mt-2">
                                                         {formatDistanceToNow(report.createdAt, { addSuffix: true, locale: id })}
                                                     </p>
                                                </div>
                                                <Badge variant="secondary" className={statusDisplay[report.status].className}>
                                                    {statusDisplay[report.status].text}
                                                </Badge>
                                            </div>
                                         </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Pengguna ini belum memiliki laporan publik.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    </div>
  );
}
