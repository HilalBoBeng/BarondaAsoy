
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { UserNav } from '@/components/dashboard/user-nav';

interface Conversation {
  id: string;
  users: string[];
  userNames: { [key: string]: string };
  userPhotos: { [key: string]: string };
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: any;
  } | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', currentUser.uid),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Conversation));
      setConversations(convos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, router]);

  const getOtherUserInfo = (convo: Conversation) => {
    if (!currentUser) return { name: '...', photo: '' };
    const otherUserId = convo.users.find(uid => uid !== currentUser.uid) || '';
    return {
      name: convo.userNames[otherUserId] || 'Warga',
      photo: convo.userPhotos[otherUserId] || '',
    };
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <Link href="/" className="font-bold text-primary">Baronda</Link>
             <UserNav />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto max-w-2xl">
                 <Card>
                    <CardHeader>
                        <CardTitle>Pesan Pribadi</CardTitle>
                        <CardDescription>Semua percakapan Anda dengan warga lain.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center space-x-4 p-2">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-[250px]" />
                                            <Skeleton className="h-4 w-[200px]" />
                                        </div>
                                    </div>
                                ))
                            ) : conversations.length > 0 ? (
                                conversations.map(convo => {
                                    const otherUser = getOtherUserInfo(convo);
                                    return (
                                        <Link key={convo.id} href={`/chat/${convo.id}`} className="block">
                                            <div className="flex items-center space-x-4 rounded-lg p-3 transition-colors hover:bg-muted">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={otherUser.photo} />
                                                    <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex justify-between">
                                                        <p className="font-semibold truncate">{otherUser.name}</p>
                                                        {convo.lastMessage && (
                                                             <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatDistanceToNow(convo.lastMessage.timestamp.toDate(), { addSuffix: true, locale: id })}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {convo.lastMessage ? `${convo.lastMessage.senderId === currentUser?.uid ? 'Anda: ' : ''}${convo.lastMessage.text}` : 'Belum ada pesan.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="py-12 text-center text-muted-foreground">
                                    <MessagesSquare className="mx-auto h-12 w-12" />
                                    <p className="mt-4">Anda belum memiliki percakapan.</p>
                                    <p className="text-xs">Mulai mengobrol dengan mencari warga lain.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    </div>
  );
}
