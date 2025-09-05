
"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, orderBy, query, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Check, CheckCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Message, AppUser } from '@/lib/types';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';


interface Chat {
  id: string;
  users: string[];
  userNames: { [key: string]: string };
  userPhotos: { [key: string]: string };
  typing?: { [key: string]: boolean };
}

export default function ChatPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const router = useRouter();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    if (!chatId) return;

    const chatDocRef = doc(db, 'chats', chatId as string);
    const unsubChat = onSnapshot(chatDocRef, (doc) => {
      if (doc.exists()) {
        const chatData = { id: doc.id, ...doc.data() } as Chat;
        if (!chatData.users.includes(currentUser.uid)) {
            notFound();
            return;
        }
        setChatInfo(chatData);
      } else {
        notFound();
      }
      setLoading(false);
    });
    
    const messagesQuery = query(collection(db, 'chats', chatId as string, 'messages'), orderBy('timestamp', 'asc'));
    const unsubMessages = onSnapshot(messagesQuery, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      const unreadMessages = snapshot.docs.filter(d => !d.data().isRead && d.data().senderId !== currentUser.uid);
      for(const docSnap of unreadMessages) {
          await updateDoc(doc(db, 'chats', chatId as string, 'messages', docSnap.id), { isRead: true });
      }

    });

    return () => {
      unsubChat();
      unsubMessages();
       if (currentUser) {
          updateDoc(chatDocRef, { [`typing.${currentUser.uid}`]: false });
       }
    };
  }, [chatId, currentUser, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateTypingStatus = (isTyping: boolean) => {
    if (!currentUser || !chatId) return;
    const chatDocRef = doc(db, 'chats', chatId as string);
    updateDoc(chatDocRef, {
      [`typing.${currentUser.uid}`]: isTyping
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    } else {
        updateTypingStatus(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
        typingTimeoutRef.current = null;
    }, 1500);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !currentUser || !chatId) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    updateTypingStatus(false);


    const messagesColRef = collection(db, 'chats', chatId as string, 'messages');
    await addDoc(messagesColRef, {
      text: newMessage,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      isRead: false,
    });
    
    const chatDocRef = doc(db, 'chats', chatId as string);
    await updateDoc(chatDocRef, {
      lastMessage: {
        text: newMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp()
      }
    });

    setNewMessage('');
  };

  const otherUser = chatInfo && currentUser ? chatInfo.users.find(uid => uid !== currentUser.uid) : null;
  const otherUserName = otherUser ? chatInfo?.userNames[otherUser] : 'Warga';
  const otherUserPhoto = otherUser ? chatInfo?.userPhotos[otherUser] : '';
  const isOtherUserTyping = otherUser ? chatInfo?.typing?.[otherUser] : false;


  if (loading) {
    return (
        <div className="flex flex-col h-screen">
            <header className="flex items-center justify-between p-4 border-b">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 mx-4"><Skeleton className="h-6 w-1/3" /></div>
            </header>
            <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-3/4 ml-auto" />
                <Skeleton className="h-10 w-2/3" />
            </div>
            <footer className="p-4 border-t"><Skeleton className="h-10 w-full" /></footer>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-muted/40">
        <header className="sticky top-0 z-10 flex items-center gap-4 p-3 border-b bg-background shadow-sm">
             <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link href="/chat"><ArrowLeft /></Link>
             </Button>
            <Avatar>
                <AvatarImage src={otherUserPhoto} />
                <AvatarFallback>{otherUserName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <h2 className="font-semibold">{otherUserName}</h2>
                {isOtherUserTyping && (
                  <p className="text-xs text-primary animate-pulse">Sedang mengetik...</p>
                )}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="space-y-4">
              {messages.map(msg => (
                  <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start')}>
                      {msg.senderId !== currentUser?.uid && (
                          <Avatar className="h-8 w-8">
                              <AvatarImage src={otherUserPhoto} />
                              <AvatarFallback>{otherUserName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                      )}
                      <div className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-sm break-words flex flex-col",
                          msg.senderId === currentUser?.uid ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm'
                      )}>
                          <p>{msg.text}</p>
                          <div className="flex items-center gap-1.5 self-end mt-1">
                              <span className="text-xs opacity-70">
                                  {msg.timestamp ? format((msg.timestamp as Timestamp).toDate(), 'HH:mm') : '...'}
                              </span>
                              {msg.senderId === currentUser?.uid && (
                                  <>
                                  {msg.isRead ? (
                                      <CheckCheck className="h-4 w-4 text-primary" style={{color: 'hsl(var(--primary))'}}/>
                                  ) : (
                                      <Check className="h-4 w-4 opacity-50"/>
                                  )}
                                  </>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
        </main>
        
        <footer className="sticky bottom-0 bg-background border-t p-2">
            <form onSubmit={sendMessage} className="flex items-center gap-2 p-2">
                 <Textarea 
                    value={newMessage} 
                    onChange={handleInputChange}
                    placeholder="Ketik pesan..." 
                    rows={1}
                    className="resize-none max-h-24 h-10"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(e);
                        }
                    }}
                 />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </footer>
    </div>
  );
}
