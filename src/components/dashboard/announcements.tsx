
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, runTransaction } from 'firebase/firestore';
import { Megaphone, Calendar, ThumbsUp, ThumbsDown, ChevronRight, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import type { Announcement } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reacting, setReacting] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();
  const router = useRouter();

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
      toast({
        variant: 'destructive',
        title: 'Akses Dibutuhkan',
        description: 'Anda harus masuk untuk memberikan reaksi.'
      });
      router.push('/auth/login');
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

        let newLikes = data.likes || 0;
        let newDislikes = data.dislikes || 0;
        let newLikesBy = [...likesBy];
        let newDislikesBy = [...dislikesBy];

        if (reaction === 'like') {
          if (hasLiked) {
            newLikes--;
            newLikesBy = newLikesBy.filter(uid => uid !== user.uid);
          } else {
            newLikes++;
            newLikesBy.push(user.uid);
            if (hasDisliked) {
              newDislikes--;
              newDislikesBy = newDislikesBy.filter(uid => uid !== user.uid);
            }
          }
        } else if (reaction === 'dislike') {
          if (hasDisliked) {
            newDislikes--;
            newDislikesBy = newDislikesBy.filter(uid => uid !== user.uid);
          } else {
            newDislikes++;
            newDislikesBy.push(user.uid);
            if (hasLiked) {
              newLikes--;
              newLikesBy = newLikesBy.filter(uid => uid !== user.uid);
            }
          }
        }
        
        transaction.update(docRef, {
            likes: newLikes,
            dislikes: newDislikes,
            likesBy: newLikesBy,
            dislikesBy: newDislikesBy
        });

        // Update local state for immediate feedback
        setAnnouncements(prev => prev.map(ann => ann.id === announcementId ? { ...ann, likes: newLikes, dislikes: newDislikes, likesBy: newLikesBy, dislikesBy: newDislikesBy } : ann));
        setSelectedAnnouncement(prev => prev ? {
            ...prev,
            likes: newLikes,
            dislikes: newDislikes,
            likesBy: newLikesBy,
            dislikesBy: newDislikesBy
        } : null);

      });
    } catch (error) {
      console.error("Transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memberikan reaksi.' });
    } finally {
      setReacting(null);
    }
  };

  const ReactionButton = ({ announcement, type }: { announcement: Announcement, type: 'like' | 'dislike' }) => {
    const hasReacted = user ? (type === 'like' ? announcement.likesBy?.includes(user.uid) : announcement.dislikesBy?.includes(user.uid)) : false;
    const count = type === 'like' ? announcement.likes : announcement.dislikes;
    const Icon = type === 'like' ? ThumbsUp : ThumbsDown;

    const button = (
       <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center gap-1.5",
            hasReacted && (type === 'like' ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/50 dark:text-green-400 dark:border-green-800" : "text-red-600 border-red-300 bg-red-50 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800")
          )}
          onClick={(e) => { e.stopPropagation(); handleReaction(announcement.id, type)}}
          disabled={reacting === announcement.id}
        >
          <Icon className="h-4 w-4" /> {count}
        </Button>
    );
    
    if (!user) {
        return (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {button}
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
  
 const renderAnnouncements = () => {
    if (loading) {
      return (
        <div className="flex space-x-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="min-w-[300px] w-[300px]">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter>
                 <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (announcements.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-10 col-span-full flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p>Belum ada pengumuman.</p>
        </div>
      );
    }

    return (
       <div className="flex space-x-4 overflow-x-auto pb-4 -mx-1 px-1">
        {announcements.map((announcement) => (
            <Card key={announcement.id} className="min-w-[300px] w-[300px] flex flex-col hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedAnnouncement(announcement)}>
                <CardHeader>
                    <CardTitle className="text-base line-clamp-2">{announcement.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">{announcement.content}</p>
                </CardContent>
                <CardFooter className="flex-col items-start gap-3">
                     <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{announcement.date as string}</span>
                    </p>
                    <Button variant="secondary" size="sm" className="w-full" onClick={(e) => {e.stopPropagation(); setSelectedAnnouncement(announcement)}}>
                        Baca Selengkapnya
                    </Button>
                </CardFooter>
            </Card>
        ))}
       </div>
    );
  };


  return (
    <div>
        {renderAnnouncements()}
        <Dialog open={!!selectedAnnouncement} onOpenChange={(isOpen) => !isOpen && setSelectedAnnouncement(null)}>
            <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
                {selectedAnnouncement && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl">{selectedAnnouncement.title}</DialogTitle>
                            <DialogDescription className="flex items-center gap-2 pt-1">
                                <Calendar className="h-4 w-4" />
                                {selectedAnnouncement.date as string}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 whitespace-pre-wrap text-sm text-muted-foreground">
                            {selectedAnnouncement.content}
                        </div>
                        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center w-full pt-4 border-t gap-4">
                             <div className="flex items-center gap-2">
                                <ReactionButton announcement={selectedAnnouncement} type="like" />
                                <ReactionButton announcement={selectedAnnouncement} type="dislike" />
                            </div>
                            <DialogClose asChild>
                               <Button type="button">Tutup</Button>
                            </DialogClose>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
