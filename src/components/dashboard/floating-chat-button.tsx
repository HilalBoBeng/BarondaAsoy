
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

    const unsubscribe = onSnapshot(chatsQuery, async (chatsSnapshot) => {
      let totalUnread = 0;

      for (const chatDoc of chatsSnapshot.docs) {
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          where('senderId', '!=', user.uid),
          where('isRead', '==', false)
        );
        
        try {
          // This query might still require an index, but it's simpler.
          // The best approach is to store unread counts on the chat document itself.
          // For now, let's try to fetch and count.
          const messagesSnapshot = await getDocs(messagesQuery);
          totalUnread += messagesSnapshot.size;
        } catch (error) {
           // Fallback if index is missing: fetch and filter on client
           const allMessagesSnapshot = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
           const unreadMessages = allMessagesSnapshot.docs.filter(doc => {
               const data = doc.data();
               return data.senderId !== user?.uid && !data.isRead;
           });
           totalUnread += unreadMessages.length;
        }
      }
      setUnreadCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user || unreadCount === 0) {
    return null;
  }

  return (
    <Link href="/chat">
        <Button
        className="fixed bottom-20 sm:bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-primary hover:bg-primary/90 flex items-center justify-center"
        >
        <MessageSquare className="h-7 w-7 text-primary-foreground" />
        {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
        </Button>
    </Link>
  );
}
