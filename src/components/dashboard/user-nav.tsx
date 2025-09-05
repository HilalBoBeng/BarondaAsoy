
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogIn, LogOut, UserPlus, Settings, User as UserIcon, Search, MessageSquare, Bell, X, UserSearch } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { getAuth, signOut, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, limit, onSnapshot, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import type { AppUser, Notification } from "@/lib/types";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
  DrawerBody,
} from "@/components/ui/drawer";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "../ui/dialog";
import Image from "next/image";


export function UserNav({ user, userInfo }: { user: User | null; userInfo: AppUser | null }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [imagePopupNotification, setImagePopupNotification] = useState<Notification | null>(null);


  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (user) {
        const notifsQuery = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid)
        );
        const unsub = onSnapshot(notifsQuery, (snapshot) => {
            let notifsData: Notification[] = [];
            let unread = 0;
            let latestUnreadImageNotif: Notification | null = null;

            snapshot.forEach(docSnap => {
                const data = { id: docSnap.id, ...docSnap.data() } as Notification;
                notifsData.push(data);
                if (!data.read) {
                    unread++;
                    if(data.imageUrl && !sessionStorage.getItem(`notif_${data.id}_shown`)) {
                        if (!latestUnreadImageNotif || (data.createdAt as Timestamp).toMillis() > (latestUnreadImageNotif.createdAt as Timestamp).toMillis()) {
                            latestUnreadImageNotif = data;
                        }
                    }
                }
            });
            
            notifsData.sort((a,b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());
            
            setNotifications(notifsData);
            setUnreadCount(unread);

            if (latestUnreadImageNotif) {
                setImagePopupNotification(latestUnreadImageNotif);
                sessionStorage.setItem(`notif_${latestUnreadImageNotif.id}_shown`, 'true');
            }
        });
        return () => unsub();
    }
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    setIsNotificationsOpen(false);
    if (!notification.read) {
       const notifRef = doc(db, 'notifications', notification.id);
       await updateDoc(notifRef, { read: true });
    }
  }
  
  const handleDialogClose = () => {
      if (selectedNotification?.link) {
          router.push(selectedNotification.link);
      }
      setSelectedNotification(null);
  }

  return (
    <>
      <div className="flex items-center gap-1 sm:gap-2">
         {user && (
          <>
             <div className="relative">
                <Button variant="ghost" size="icon" onClick={() => setIsNotificationsOpen(true)}>
                    <Bell className="h-5 w-5" />
                </Button>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 text-xs items-center justify-center bg-primary text-primary-foreground">{unreadCount}</span>
                    </span>
                )}
             </div>
          </>
         )}
      </div>

      <Drawer open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DrawerContent className="max-h-[40dvh]">
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader>
              <DrawerTitle>Notifikasi</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="p-4 pt-0 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map(notif => (
                  <div key={notif.id} onClick={() => handleNotificationClick(notif)}
                       className={cn("p-3 mb-2 border-l-4 rounded-r-md cursor-pointer hover:bg-muted/50",
                       notif.read ? 'border-transparent' : 'border-primary bg-primary/10'
                       )}>
                      <p className="font-semibold text-sm">{notif.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notif.message.replace(/<[^>]+>/g, '')}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Tidak ada notifikasi.</p>
              )}
            </DrawerBody>
            <DrawerFooter className="mt-auto">
              <DrawerClose asChild>
                <Button variant="outline">Tutup</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

       <Drawer open={!!selectedNotification} onOpenChange={(open) => !open && handleDialogClose()}>
          <DrawerContent>
            {selectedNotification && (
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>{selectedNotification.title}</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>
                  <div className="py-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedNotification.message.replace(/\n/g, '<br />') }}></div>
                </DrawerBody>
                <DrawerFooter>
                  <Button onClick={handleDialogClose}>Tutup</Button>
                </DrawerFooter>
              </div>
            )}
          </DrawerContent>
        </Drawer>
        
        <Dialog open={!!imagePopupNotification} onOpenChange={() => setImagePopupNotification(null)}>
            <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-lg w-full">
                 <DialogTitle className="sr-only">{imagePopupNotification?.title}</DialogTitle>
                 {imagePopupNotification?.imageUrl && (
                    <div className="relative w-full h-full">
                       <Image
                           src={imagePopupNotification.imageUrl}
                           alt={imagePopupNotification.title || 'Pengumuman'}
                           layout="fill"
                           objectFit="contain"
                           className="rounded-lg"
                       />
                        <DialogClose asChild>
                            <Button size="icon" variant="secondary" className="absolute top-2 right-2 rounded-full h-8 w-8 z-10">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </div>
                 )}
            </DialogContent>
        </Dialog>
    </>
  );
}
