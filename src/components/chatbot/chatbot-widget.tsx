
"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Bot, User, Loader2, MessageSquareText, BrainCircuit } from 'lucide-react';
import { chat } from '@/ai/flows/chatbot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getAuth } from 'firebase/auth';
import { app, db } from '@/lib/firebase/client';
import { addDoc, collection, doc, serverTimestamp, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import type { LiveChatSession, LiveChatMessage } from '@/lib/types';


interface Message {
    sender: 'user' | 'ai' | 'agent';
    text: string;
}

const CHAT_SESSION_ID_KEY = 'baronda_live_chat_session_id';

export default function ChatbotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState<'options' | 'ai' | 'live'>('options');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const auth = getAuth(app);
    const user = auth.currentUser;
    const [liveChatSession, setLiveChatSession] = useState<LiveChatSession | null>(null);

    // Effect to check for and restore an active session from localStorage
    useEffect(() => {
        const checkAndRestoreSession = async () => {
            if (!user) return;
            const sessionId = localStorage.getItem(CHAT_SESSION_ID_KEY);
            if (sessionId) {
                const sessionRef = doc(db, 'live_chats', sessionId);
                const sessionSnap = await getDoc(sessionRef);
                if (sessionSnap.exists()) {
                    const sessionData = { id: sessionId, ...sessionSnap.data() } as LiveChatSession;
                    if (sessionData.status !== 'closed') {
                        setLiveChatSession(sessionData); // Restore session state
                        setChatMode('live');
                        setIsOpen(true);
                    } else {
                        // Clean up if the session was closed
                        localStorage.removeItem(CHAT_SESSION_ID_KEY);
                    }
                } else {
                     localStorage.removeItem(CHAT_SESSION_ID_KEY);
                }
            }
        };
        checkAndRestoreSession();
    }, [user]);

    // Effect to subscribe to live chat session updates (status changes) and messages
    useEffect(() => {
        if (!liveChatSession?.id) return;

        // Listen for session status changes (e.g., pending -> active)
        const sessionUnsub = onSnapshot(doc(db, 'live_chats', liveChatSession.id), (doc) => {
            if (doc.exists()) {
                const updatedSession = { id: doc.id, ...doc.data() } as LiveChatSession;
                setLiveChatSession(updatedSession); // Update the session state in real-time
            }
        });

        // Listen for new messages
        const messagesQuery = collection(db, `live_chats/${liveChatSession.id}/messages`);
        const messagesUnsub = onSnapshot(messagesQuery, (snapshot) => {
            const newMessages: Message[] = snapshot.docs
                .map(doc => {
                    const data = doc.data() as LiveChatMessage;
                    return {
                        sender: data.senderId === user?.uid ? 'user' : 'agent',
                        text: data.text
                    };
                })
                .sort((a,b) => (a as any).timestamp - (b as any).timestamp); 
            setMessages(newMessages);
        });

        return () => {
            sessionUnsub();
            messagesUnsub();
        };

    }, [liveChatSession?.id, user?.uid]);


    useEffect(() => {
        if (isOpen && scrollAreaRef.current) {
            setTimeout(() => {
                 const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                 if (viewport) {
                    viewport.scrollTop = viewport.scrollHeight;
                 }
            }, 100);
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            if (chatMode === 'ai') {
                const aiResponse = await chat(input);
                const aiMessage: Message = { sender: 'ai', text: aiResponse };
                setMessages(prev => [...prev, aiMessage]);
            } else if (chatMode === 'live' && liveChatSession && user) {
                const messagesRef = collection(db, `live_chats/${liveChatSession.id}/messages`);
                await addDoc(messagesRef, {
                    text: input,
                    timestamp: serverTimestamp(),
                    senderId: user.uid,
                    senderName: user.displayName || 'User',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Gagal Mengirim Pesan',
                description: 'Terjadi kesalahan. Silakan coba lagi nanti.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const startAIChat = () => {
        setMessages([{ sender: 'ai', text: "Halo! Saya asisten AI Baronda. Ada yang bisa saya bantu seputar aplikasi ini?" }]);
        setChatMode('ai');
    }

    const startLiveChat = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Login Diperlukan', description: 'Anda harus masuk untuk memulai live chat.' });
            return;
        }

        setChatMode('live');
        setIsLoading(true);
        setMessages([{ sender: 'agent', text: "Mencari petugas yang tersedia..." }]);

        try {
            const newSessionRef = await addDoc(collection(db, 'live_chats'), {
                userId: user.uid,
                userName: user.displayName,
                userEmail: user.email,
                userPhotoURL: user.photoURL,
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            localStorage.setItem(CHAT_SESSION_ID_KEY, newSessionRef.id);
            const newSessionData = {
                id: newSessionRef.id,
                 userId: user.uid,
                userName: user.displayName,
                userEmail: user.email,
                status: 'pending',
            } as LiveChatSession;

            setLiveChatSession(newSessionData);
            setMessages([{ sender: 'agent', text: `Anda berada di antrean. Mohon tunggu, seorang petugas akan segera melayani Anda.` }]);

        } catch (error) {
             toast({ variant: 'destructive', title: 'Gagal Memulai Obrolan', description: 'Tidak dapat memulai sesi obrolan baru.' });
             setChatMode('options');
        } finally {
            setIsLoading(false);
        }
    }
    
    const closeChat = async () => {
        if (liveChatSession) {
            const sessionRef = doc(db, 'live_chats', liveChatSession.id);
            await updateDoc(sessionRef, { status: 'closed', closedAt: serverTimestamp() });
        }
        localStorage.removeItem(CHAT_SESSION_ID_KEY);
        setLiveChatSession(null);
        setIsOpen(false);
        setTimeout(() => {
            setMessages([]);
            setChatMode('options');
        }, 300);
    }
    
    return (
        <>
            {/* Chat bubble */}
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    onClick={() => setIsOpen(prev => !prev)}
                    className="rounded-full w-14 h-14 shadow-2xl animate-fade-in"
                >
                    {isOpen ? <X className="h-7 w-7" /> : 
                        <Image src="https://iili.io/KJ4aGxp.png" alt="Chat" width={40} height={40} />
                    }
                </Button>
            </div>

            {/* Chat window */}
            <div className={cn(
                "fixed bottom-24 right-6 z-50 w-full max-w-sm transition-all duration-300 ease-out",
                isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            )}>
                <Card className="flex flex-col h-[60vh] shadow-2xl">
                    <CardHeader className="flex-row items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Bot className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Bantuan Baronda</CardTitle>
                            </div>
                         </div>
                         {chatMode === 'live' && <Button size="sm" variant="ghost" onClick={closeChat}>Akhiri</Button>}
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden p-0">
                        <ScrollArea className="h-full" ref={scrollAreaRef}>
                            <div className="p-6 space-y-4">
                                {chatMode === 'options' && (
                                    <div className="flex flex-col gap-4 items-center justify-center h-full">
                                        <Button className="w-full h-auto py-4" onClick={startAIChat}>
                                            <BrainCircuit className="h-6 w-6 mr-3"/>
                                            <span className="flex flex-col items-start">
                                                <span>Tanya Asisten AI</span>
                                                <span className="text-xs font-normal opacity-80">Dapatkan jawaban cepat</span>
                                            </span>
                                        </Button>
                                        <Button className="w-full h-auto py-4" variant="secondary" onClick={startLiveChat}>
                                            <MessageSquareText className="h-6 w-6 mr-3"/>
                                            <span className="flex flex-col items-start">
                                                <span>Live Chat dengan Petugas</span>
                                                <span className="text-xs font-normal opacity-80">Bicara dengan manusia</span>
                                            </span>
                                        </Button>
                                    </div>
                                )}
                                {(chatMode === 'ai' || chatMode === 'live') && messages.map((message, index) => (
                                    <div key={index} className={cn("flex items-start gap-3", message.sender === 'user' ? 'justify-end' : '')}>
                                        {(message.sender === 'ai' || message.sender === 'agent') && (
                                           <Avatar className="h-8 w-8">
                                                <AvatarImage src="https://iili.io/KJ4aGxp.png" alt="AI Avatar" />
                                                <AvatarFallback>AI</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn(
                                            "max-w-xs rounded-lg px-4 py-2 text-sm",
                                            message.sender === 'user'
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground"
                                        )}>
                                            <p className="whitespace-pre-wrap">{message.text}</p>
                                        </div>
                                         {message.sender === 'user' && <User className="h-6 w-6 text-muted-foreground" />}
                                    </div>
                                ))}
                                {isLoading && (
                                     <div className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src="https://iili.io/KJ4aGxp.png" alt="AI Avatar" />
                                            <AvatarFallback>AI</AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted rounded-lg px-4 py-3">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                     {chatMode !== 'options' && (
                        <CardFooter className="pt-6">
                            <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={chatMode === 'ai' ? "Tanya tentang Baronda..." : "Ketik pesan Anda..."}
                                    disabled={isLoading || (chatMode === 'live' && liveChatSession?.status !== 'active')}
                                    className="flex-grow"
                                />
                                <Button type="submit" size="icon" disabled={isLoading || !input.trim() || (chatMode === 'live' && liveChatSession?.status !== 'active')}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </CardFooter>
                     )}
                </Card>
            </div>
        </>
    );
}
