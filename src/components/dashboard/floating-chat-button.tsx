
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, getDocs, collectionGroup } from 'firebase/firestore';
import { getAuth, type User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

export default function FloatingChatButton() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const chatsQuery = query(collection(db, 'chats'), where('users', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(chatsQuery, (chatsSnapshot) => {
      let totalUnread = 0;
      const promises: Promise<void>[] = [];

      if (chatsSnapshot.empty) {
        setUnreadCount(0);
        return;
      }
      
      chatsSnapshot.forEach(chatDoc => {
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          where('senderId', '!=', user.uid),
          where('isRead', '==', false)
        );
        
        const promise = getDocs(messagesQuery).then(messagesSnapshot => {
          totalUnread += messagesSnapshot.size;
        });
        promises.push(promise);
      });

      Promise.all(promises).then(() => {
        setUnreadCount(totalUnread);
      });
    });

    return () => unsubscribe();
  }, [user]);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Link href="/chat">
        <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-primary hover:bg-primary/90 flex items-center justify-center"
        >
        <MessageSquare className="h-7 w-7 text-primary-foreground" />
        {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
            {unreadCount}
            </span>
        )}
        </Button>
    </Link>
  );
}
