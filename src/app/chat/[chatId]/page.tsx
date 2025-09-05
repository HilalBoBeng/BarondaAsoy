
"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, orderBy, query, updateDoc, Timestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Check, CheckCheck, MoreVertical, Trash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Message, AppUser } from '@/lib/types';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { id } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


interface Chat {
  id: string;
  users: string[];
  userNames: { [key: string]: string };
  userPhotos: { [key: string]: string };
  typing?: { [key: string]: boolean };
  lastActive?: { [key: string]: Timestamp };
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

        // Update user's last active timestamp
        updateDoc(chatDocRef, {
          [`lastActive.${currentUser.uid}`]: serverTimestamp(),
        });

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
    
     const handleVisibilityChange = () => {
        if (document.hidden) {
            updateDoc(chatDocRef, { [`typing.${currentUser.uid}`]: false });
        }
     }
     document.addEventListener("visibilitychange", handleVisibilityChange);


    return () => {
      unsubChat();
      unsubMessages();
       if (currentUser) {
          updateDoc(chatDocRef, { [`typing.${currentUser.uid}`]: false });
       }
       document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  
  const handleDeleteMessage = async (messageId: string) => {
     if (!chatId) return;
     const messageRef = doc(db, 'chats', chatId as string, 'messages', messageId);
     await deleteDoc(messageRef);
  }

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
  const otherUserLastActive = otherUser && chatInfo?.lastActive?.[otherUser] ? (chatInfo.lastActive[otherUser] as Timestamp).toDate() : null;

  const renderStatus = () => {
    if (isOtherUserTyping) {
        return <p className="text-xs text-primary animate-pulse">Sedang mengetik...</p>;
    }
    if (otherUserLastActive) {
        const now = new Date();
        const diffSeconds = (now.getTime() - otherUserLastActive.getTime()) / 1000;
        if (diffSeconds < 60) {
             return <p className="text-xs text-muted-foreground">Aktif</p>;
        }
        return <p className="text-xs text-muted-foreground">Dilihat {formatDistanceToNowStrict(otherUserLastActive, { addSuffix: true, locale: id })}</p>;
    }
    return <p className="text-xs text-muted-foreground">Offline</p>;
  };


  if (loading) {
    return (
        <div className="flex flex-col h-screen">
            <header className="sticky top-0 z-10 flex items-center gap-4 p-3 border-b bg-background shadow-sm">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </header>
            <div className="flex-1 p-4 space-y-4">
                <div className="flex items-end gap-2 justify-start">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
                <div className="flex items-end gap-2 justify-end">
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                 <div className="flex items-end gap-2 justify-start">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-16 w-64 rounded-lg" />
                </div>
                 <div className="flex items-end gap-2 justify-end">
                    <Skeleton className="h-10 w-40 rounded-lg" />
                </div>
            </div>
            <footer className="sticky bottom-0 bg-background border-t p-2">
                <div className="flex items-center gap-2 p-2">
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                    <Skeleton className="h-10 w-10 rounded-md" />
                </div>
            </footer>
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
                {renderStatus()}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="space-y-4">
              {messages.map(msg => (
                  <div key={msg.id} className={cn("flex items-end gap-2 group", msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start')}>
                     {msg.senderId !== currentUser?.uid && (
                          <Avatar className="h-8 w-8">
                              <AvatarImage src={otherUserPhoto} />
                              <AvatarFallback>{otherUserName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                      )}
                      <div className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-sm break-words flex flex-col relative",
                          msg.senderId === currentUser?.uid ? 'bg-primary text-primary-foreground' : 'bg-card border'
                      )}>
                           {msg.senderId === currentUser?.uid && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                         <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/20">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="text-destructive focus:text-destructive">
                                            <Trash className="mr-2 h-4 w-4"/> Hapus
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                           )}
                          <p className="pr-4">{msg.text}</p>
                          <div className="flex items-center gap-1.5 self-end mt-1">
                              <span className="text-xs opacity-70">
                                  {msg.timestamp ? format((msg.timestamp as Timestamp).toDate(), 'HH:mm') : '...'}
                              </span>
                              {msg.senderId === currentUser?.uid && (
                                  <>
                                  {msg.isRead ? (
                                      <CheckCheck className="h-4 w-4 text-accent" />
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
