
"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, query, where, serverTimestamp, addDoc, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Clock, Loader2, Send, Phone, Mail, FileText, BadgeCheck } from 'lucide-react';
import type { LiveChatSession, Report, AppUser, LiveChatMessage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function LiveChatAdminPage() {
    const [allChats, setAllChats] = useState<LiveChatSession[]>([]);
    const [selectedChat, setSelectedChat] = useState<LiveChatSession | null>(null);
    const [messages, setMessages] = useState<LiveChatMessage[]>([]);
    const [userDetails, setUserDetails] = useState<AppUser | null>(null);
    const [userReports, setUserReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Fetch all chats
    useEffect(() => {
        const q = query(collection(db, 'live_chats'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatsData: LiveChatSession[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveChatSession));
            setAllChats(chatsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch messages for selected chat
    useEffect(() => {
        if (selectedChat) {
            const messagesQuery = query(
                collection(db, `live_chats/${selectedChat.id}/messages`), 
                orderBy('timestamp', 'asc')
            );
            const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveChatMessage));
                setMessages(messagesData);
            });

            // Fetch user details and reports
            const userDocRef = doc(db, 'users', selectedChat.userId);
            const unsubUser = onSnapshot(userDocRef, (docSnap) => setUserDetails(docSnap.data() as AppUser));
            
            const reportsQuery = query(collection(db, 'reports'), where('userId', '==', selectedChat.userId), orderBy('createdAt', 'desc'));
            const unsubReports = onSnapshot(reportsQuery, (snap) => setUserReports(snap.docs.map(d => d.data() as Report)));


            return () => {
                unsubscribe();
                unsubUser();
                unsubReports();
            };
        }
    }, [selectedChat]);
    
    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages]);


    const handleAcceptChat = async (chat: LiveChatSession) => {
        setIsAccepting(chat.id);
        const adminInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        
        try {
            const chatRef = doc(db, 'live_chats', chat.id);
            await updateDoc(chatRef, {
                status: 'active',
                agentId: adminInfo.id || 'admin',
                agentName: adminInfo.name || 'Admin',
                acceptedAt: serverTimestamp()
            });

            // Send introductory message
            const messagesRef = collection(db, `live_chats/${chat.id}/messages`);
            await addDoc(messagesRef, {
                text: `Halo ${chat.userName}, saya ${adminInfo.name || 'Admin'}. Ada yang bisa saya bantu?`,
                timestamp: serverTimestamp(),
                senderId: adminInfo.id || 'admin',
                senderName: adminInfo.name || 'Admin',
            });

            setSelectedChat({ ...chat, status: 'active' });
        } catch (error) {
            console.error("Failed to accept chat:", error);
            toast({ variant: 'destructive', title: "Gagal", description: "Gagal menerima obrolan." });
        } finally {
            setIsAccepting(null);
        }
    };
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedChat || isSending) return;

        const adminInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        setIsSending(true);

        try {
            const messagesRef = collection(db, `live_chats/${selectedChat.id}/messages`);
            await addDoc(messagesRef, {
                text: messageInput,
                timestamp: serverTimestamp(),
                senderId: adminInfo.id || 'admin',
                senderName: adminInfo.name || 'Admin',
            });
            setMessageInput('');
        } catch (error) {
             toast({ variant: 'destructive', title: "Gagal", description: "Gagal mengirim pesan." });
        } finally {
            setIsSending(false);
        }
    };

    const handleCloseChat = async () => {
        if (!selectedChat) return;
        try {
            await updateDoc(doc(db, 'live_chats', selectedChat.id), {
                status: 'closed',
                closedAt: serverTimestamp()
            });
            setSelectedChat(null);
            toast({ title: "Berhasil", description: "Obrolan telah ditutup." });
        } catch (error) {
             toast({ variant: 'destructive', title: "Gagal", description: "Gagal menutup obrolan." });
        }
    };

    const statusPriority = { 'pending': 1, 'active': 2, 'closed': 3 };
    const sortedChats = [...allChats].sort((a, b) => {
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis();
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_300px] h-[calc(100vh-120px)] gap-4">
            {/* Chat List */}
            <Card className="flex flex-col">
                <CardHeader><CardTitle>Antrean & Obrolan</CardTitle></CardHeader>
                <ScrollArea className="flex-1">
                    <CardContent className="p-2">
                    {loading ? <Skeleton className="h-20 w-full" /> : (
                        sortedChats.map(chat => (
                             <div
                                key={chat.id}
                                className={cn(
                                    "w-full h-auto flex items-start justify-start p-3 text-left mb-2 rounded-lg cursor-pointer hover:bg-muted",
                                    selectedChat?.id === chat.id && "bg-muted",
                                    chat.status === 'pending' && "border border-primary/50"
                                )}
                                onClick={() => { setSelectedChat(chat) }}
                             >
                                <Avatar className="h-10 w-10 mr-3">
                                    <AvatarImage src={chat.userPhotoURL || undefined} />
                                    <AvatarFallback><User /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold truncate">{chat.userName}</p>
                                    <p className="text-xs text-muted-foreground">{chat.userEmail}</p>
                                     {chat.status === 'pending' && (
                                        <div className="mt-2">
                                            <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); handleAcceptChat(chat); }} disabled={!!isAccepting}>
                                                {isAccepting === chat.id ? <Loader2 className="h-4 w-4 animate-spin"/> : "Terima"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                             </div>
                        ))
                    )}
                    </CardContent>
                </ScrollArea>
            </Card>

            {/* Chat Window */}
            <Card className="flex flex-col h-full">
                {selectedChat ? (
                    <>
                    <CardHeader className="flex-row items-center justify-between border-b">
                        <div>
                            <CardTitle>{selectedChat.userName}</CardTitle>
                            <CardDescription>
                                {selectedChat.status === 'active' 
                                    ? `Aktif sejak ${formatDistanceToNow((selectedChat.acceptedAt as Timestamp)?.toDate() || new Date(), { addSuffix: true, locale: id })}` 
                                    : `Ditutup`
                                }
                            </CardDescription>
                        </div>
                         {selectedChat.status === 'active' && (
                            <Button variant="destructive" onClick={handleCloseChat}>Tutup Obrolan</Button>
                        )}
                    </CardHeader>
                    <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
                        <div className="space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId !== selectedChat.userId ? 'justify-end' : 'justify-start')}>
                                {msg.senderId === selectedChat.userId && <Avatar className="h-8 w-8"><AvatarImage src={selectedChat.userPhotoURL} /><AvatarFallback><User/></AvatarFallback></Avatar>}
                                <div className={cn(
                                    "max-w-xs rounded-lg px-3 py-2 text-sm break-words",
                                    msg.senderId !== selectedChat.userId ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                )}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    <CardFooter className="pt-4 border-t">
                        <form className="flex w-full items-center gap-2" onSubmit={handleSendMessage}>
                            <Input 
                                placeholder="Ketik balasan..." 
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                disabled={isSending || selectedChat.status !== 'active'}
                            />
                            <Button type="submit" size="icon" disabled={isSending || selectedChat.status !== 'active'}><Send className="h-4 w-4" /></Button>
                        </form>
                    </CardFooter>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Pilih obrolan untuk ditampilkan</p>
                    </div>
                )}
            </Card>
            
            {/* User Details */}
            <Card className="h-full">
                 <CardHeader><CardTitle>Detail Pengguna</CardTitle></CardHeader>
                 <CardContent>
                    {selectedChat && userDetails ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={selectedChat.userPhotoURL} />
                                    <AvatarFallback className="text-2xl"><User /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold text-lg">{userDetails.displayName}</p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-green-500" /> Terverifikasi</p>
                                </div>
                            </div>
                             <Separator />
                             <div className="space-y-2 text-sm">
                                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/> {userDetails.email}</p>
                             </div>
                             <Separator />
                             <div>
                                <h4 className="font-semibold mb-2">Riwayat Laporan</h4>
                                <ScrollArea className="h-48">
                                    <div className="space-y-2">
                                    {userReports.length > 0 ? userReports.map(report => (
                                        <div key={report.id} className="text-xs border p-2 rounded-md">
                                            <p className="font-semibold truncate">{report.reportText}</p>
                                            <p className="text-muted-foreground">{format((report.createdAt as Timestamp).toDate(), "d MMM yyyy", { locale: id })}</p>
                                        </div>
                                    )) : <p className="text-xs text-muted-foreground">Tidak ada riwayat laporan.</p>}
                                    </div>
                                </ScrollArea>
                             </div>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground pt-10">Pilih obrolan untuk melihat detail.</div>
                    )}
                 </CardContent>
            </Card>

        </div>
    );
}

    
