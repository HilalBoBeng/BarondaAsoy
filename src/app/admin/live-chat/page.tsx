
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Clock, Loader2 } from 'lucide-react';
import type { LiveChatSession } from '@/lib/types';


export default function LiveChatAdminPage() {
    const [pendingChats, setPendingChats] = useState<LiveChatSession[]>([]);
    const [activeChats, setActiveChats] = useState<LiveChatSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'live_chats'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allChats: LiveChatSession[] = [];
            snapshot.forEach(doc => {
                 allChats.push({ id: doc.id, ...doc.data() } as LiveChatSession)
            });

            setPendingChats(allChats.filter(c => c.status === 'pending'));
            setActiveChats(allChats.filter(c => c.status === 'active' || c.status === 'closed'));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAcceptChat = async (chatId: string) => {
        setIsAccepting(chatId);
        const adminInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        
        try {
            const chatRef = doc(db, 'live_chats', chatId);
            await updateDoc(chatRef, {
                status: 'active',
                agentId: adminInfo.id || 'admin',
                agentName: adminInfo.name || 'Admin',
                acceptedAt: serverTimestamp()
            });
            // The rest of the logic (opening chat window) would go here.
        } catch (error) {
            console.error("Failed to accept chat:", error);
        } finally {
            setIsAccepting(null);
        }
    };
    
    const PendingChatCard = ({ chat }: { chat: LiveChatSession }) => (
        <Card>
            <CardHeader className="flex-row items-center gap-4">
                <Avatar>
                    <AvatarImage src={chat.userPhotoURL || undefined} />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-base">{chat.userName}</CardTitle>
                    <CardDescription className="text-xs">{chat.userEmail}</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Menunggu sejak {formatDistanceToNow((chat.createdAt as any)?.toDate(), { addSuffix: true, locale: id })}</span>
                </div>
                <Button className="w-full mt-4" onClick={() => handleAcceptChat(chat.id)} disabled={!!isAccepting}>
                    {isAccepting === chat.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Terima Obrolan
                </Button>
            </CardContent>
        </Card>
    )

    return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 space-y-4">
                <h2 className="text-lg font-semibold">Antrean Obrolan</h2>
                 {loading ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
                ) : pendingChats.length > 0 ? (
                    pendingChats.map(chat => <PendingChatCard key={chat.id} chat={chat} />)
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Tidak ada obrolan yang menunggu.</p>
                )}
            </div>
            <div className="lg:col-span-2">
                 <h2 className="text-lg font-semibold">Obrolan Aktif & Riwayat</h2>
                 <Card className="mt-4">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground text-center">Fitur jendela obrolan aktif akan diimplementasikan di sini.</p>
                    </CardContent>
                 </Card>
            </div>
        </div>
    )
}
