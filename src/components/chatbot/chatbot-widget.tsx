
"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { chat } from '@/ai/flows/chatbot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';


interface Message {
    sender: 'user' | 'ai';
    text: string;
}

export default function ChatbotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'ai', text: "Halo! Saya asisten AI Baronda. Ada yang bisa saya bantu seputar aplikasi ini?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

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
            const aiResponse = await chat(input);
            const aiMessage: Message = { sender: 'ai', text: aiResponse };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Gagal Menghubungi AI',
                description: 'Terjadi kesalahan. Silakan coba lagi nanti.'
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            {/* Chat bubble */}
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    className="rounded-full w-16 h-16 shadow-2xl animate-fade-in"
                >
                    {isOpen ? <X className="h-8 w-8" /> : 
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
                    <CardHeader className="flex-row items-center gap-3">
                         <div className="p-2 bg-primary/10 rounded-full">
                            <Bot className="h-6 w-6 text-primary" />
                         </div>
                         <div>
                            <CardTitle>Asisten AI Baronda</CardTitle>
                         </div>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden p-0">
                        <ScrollArea className="h-full" ref={scrollAreaRef}>
                            <div className="p-6 space-y-4">
                                {messages.map((message, index) => (
                                    <div key={index} className={cn("flex items-start gap-3", message.sender === 'user' ? 'justify-end' : '')}>
                                        {message.sender === 'ai' && (
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
                    <CardFooter className="pt-6">
                        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Tanya tentang Baronda..."
                                disabled={isLoading}
                                className="flex-grow"
                            />
                            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
}

