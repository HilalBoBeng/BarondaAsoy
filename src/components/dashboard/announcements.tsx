
"use client";

import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, runTransaction, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { Megaphone, Calendar, ThumbsUp, ThumbsDown } from 'lucide-react';
import Autoplay from "embla-carousel-autoplay"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../ui/carousel';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reacting, setReacting] = useState<string | null>(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();

  const plugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  )

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const announcementsData: Announcement[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        announcementsData.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          date: data.date.toDate ? data.date.toDate().toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) : data.date,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          likesBy: data.likesBy || [],
          dislikesBy: data.dislikesBy || [],
        });
      });
      setAnnouncements(announcementsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReaction = async (announcementId: string, reaction: 'like' | 'dislike') => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Anda harus masuk untuk memberikan reaksi.' });
      return;
    }
    if (reacting) return;

    setReacting(announcementId);
    const docRef = doc(db, 'announcements', announcementId);

    try {
      await runTransaction(db, async (transaction) => {
        const annDoc = await transaction.get(docRef);
        if (!annDoc.exists()) {
          throw "Document does not exist!";
        }

        const data = annDoc.data();
        const likesBy = data.likesBy || [];
        const dislikesBy = data.dislikesBy || [];
        const hasLiked = likesBy.includes(user.uid);
        const hasDisliked = dislikesBy.includes(user.uid);

        if (reaction === 'like') {
          if (hasLiked) {
            // User wants to remove their like
            transaction.update(docRef, {
              likes: increment(-1),
              likesBy: arrayRemove(user.uid),
            });
          } else {
            // User wants to add a like
            transaction.update(docRef, {
              likes: increment(1),
              likesBy: arrayUnion(user.uid),
            });
            // If user had disliked before, remove dislike
            if (hasDisliked) {
              transaction.update(docRef, {
                dislikes: increment(-1),
                dislikesBy: arrayRemove(user.uid),
              });
            }
          }
        } else if (reaction === 'dislike') {
          if (hasDisliked) {
            // User wants to remove their dislike
            transaction.update(docRef, {
              dislikes: increment(-1),
              dislikesBy: arrayRemove(user.uid),
            });
          } else {
            // User wants to add a dislike
            transaction.update(docRef, {
              dislikes: increment(1),
              dislikesBy: arrayUnion(user.uid),
            });
            // If user had liked before, remove like
            if (hasLiked) {
              transaction.update(docRef, {
                likes: increment(-1),
                likesBy: arrayRemove(user.uid),
              });
            }
          }
        }
      });
    } catch (error) {
      console.error("Transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memberikan reaksi.' });
    } finally {
      setReacting(null);
    }
  };

  const ReactionButton = ({ announcement, type }: { announcement: Announcement, type: 'like' | 'dislike' }) => {
    const hasReacted = type === 'like' ? announcement.likesBy?.includes(user?.uid || '') : announcement.dislikesBy?.includes(user?.uid || '');
    const count = type === 'like' ? announcement.likes : announcement.dislikes;
    const Icon = type === 'like' ? ThumbsUp : ThumbsDown;

    const button = (
       <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1 text-muted-foreground",
            hasReacted && (type === 'like' ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100")
          )}
          onClick={() => handleReaction(announcement.id, type)}
          disabled={!user || reacting === announcement.id}
        >
          <Icon className="h-4 w-4" /> {count}
        </Button>
    );
    
    if (!user) {
        return (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span tabIndex={0}>{button}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Masuk untuk memberi reaksi</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return button;
  }

  return (
    <div>
       {loading ? (
          <div className="flex items-center justify-center p-10">
            <Skeleton className="h-48 w-full max-w-lg" />
          </div>
      ) : announcements.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
            Belum ada pengumuman.
        </div>
      ) : (
        <Carousel 
            plugins={[plugin.current]}
            opts={{
                align: "start",
                loop: true,
            }}
            className="w-full"
            onMouseEnter={plugin.current.stop}
            onMouseLeave={plugin.current.reset}
        >
            <CarouselContent>
                {announcements.map((announcement) => (
                    <CarouselItem key={announcement.id} className="md:basis-1/2 lg:basis-1/3">
                         <div className="p-1 h-full">
                            <Card className="flex flex-col h-full">
                                <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                                    <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                                        <Calendar className="h-4 w-4" />
                                        <span>{announcement.date as string}</span>
                                    </CardDescription>
                                    </div>
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Megaphone className="h-5 w-5" />
                                    </div>
                                </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">{announcement.content}</p>
                                </CardContent>
                                <CardFooter className="flex items-center justify-end gap-2">
                                <ReactionButton announcement={announcement} type="like" />
                                <ReactionButton announcement={announcement} type="dislike" />
                                </CardFooter>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="ml-10" />
            <CarouselNext className="mr-10" />
        </Carousel>
      )}
    </div>
  );
}
