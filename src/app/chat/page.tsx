
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';
import { Home, UserCircle, MessageSquare, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  unreadCount?: { [key: string]: number };
}

const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/chat", icon: MessageSquare, label: "Pesan" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));

      convos.sort((a, b) => {
        const timeA = (a.lastMessage?.timestamp as Timestamp)?.toMillis() || 0;
        const timeB = (b.lastMessage?.timestamp as Timestamp)?.toMillis() || 0;
        return timeB - timeA;
      });

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
    <div className="flex h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <h1 className="text-xl font-bold">Pesan</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 animate-fade-in-up">
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
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
                        const unread = convo.unreadCount?.[currentUser?.uid || ''] || 0;
                        return (
                            <Link key={convo.id} href={`/chat/${convo.id}`} className="block">
                                <div className="flex items-center space-x-4 rounded-lg p-2 transition-colors hover:bg-muted">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={otherUser.photo} />
                                        <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex justify-between">
                                            <p className="font-semibold truncate">{otherUser.name}</p>
                                            {convo.lastMessage && convo.lastMessage.timestamp && (
                                                 <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(convo.lastMessage.timestamp.toDate(), { addSuffix: true, locale: id })}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={cn("text-sm text-muted-foreground truncate", unread > 0 && "font-bold text-foreground")}>
                                                {convo.lastMessage ? `${convo.lastMessage.senderId === currentUser?.uid ? 'Anda: ' : ''}${convo.lastMessage.text}` : 'Belum ada pesan.'}
                                            </p>
                                            {unread > 0 && (
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                                    {unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div className="pt-24 text-center text-muted-foreground">
                        <MessageSquare className="mx-auto h-12 w-12" />
                        <p className="mt-4">Anda belum memiliki percakapan.</p>
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
    </div>
  );
}
