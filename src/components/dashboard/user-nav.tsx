
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
} from "@/components/ui/drawer";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from "../ui/dialog";


export function UserNav({ user, userInfo }: { user: User | null; userInfo: AppUser | null }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
        const notifsQuery = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid)
        );
        const unsub = onSnapshot(notifsQuery, (snapshot) => {
            const notifsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Notification);
            
            notifsData.sort((a, b) => {
              const timeA = (a.createdAt as Timestamp)?.toMillis() || 0;
              const timeB = (b.createdAt as Timestamp)?.toMillis() || 0;
              return timeB - timeA;
            });

            setNotifications(notifsData);
            setUnreadCount(notifsData.filter(n => !n.read).length);
        });
        return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearch = async (queryText: string) => {
    setSearchQuery(queryText);
    if (!queryText.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      const allUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      
      const lowerCaseQuery = queryText.toLowerCase();
      const results = allUsers.filter(u => 
          u.displayName?.toLowerCase().includes(lowerCaseQuery) && u.uid !== user?.uid
      );
      setSearchResults(results.slice(0, 10)); // Limit results
    } catch (error) {
      toast({ variant: 'destructive', title: 'Pencarian Gagal' });
    } finally {
      setIsSearching(false);
    }
  };

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
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-5 w-5" />
            </Button>
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

      <div className={cn("absolute top-0 left-0 w-full h-16 bg-background border-b z-40 flex items-center px-4 transition-transform duration-300",
          isSearchOpen ? 'translate-y-0' : '-translate-y-full'
      )}>
         <Input 
           ref={searchInputRef}
           value={searchQuery}
           onChange={(e) => handleSearch(e.target.value)}
           placeholder="Cari warga lain..."
           className="h-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base"
          />
          {isSearching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-3" />}
          <Button variant="ghost" size="icon" onClick={() => { setIsSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}>
              <X className="h-5 w-5" />
          </Button>
     </div>

     {isSearchOpen && searchQuery && (
        <Card className="absolute top-16 left-0 right-0 mx-auto sm:left-auto sm:right-4 w-[95%] sm:max-w-sm sm:w-80 z-40 shadow-lg sm:rounded-t-lg">
            <div className="p-2 max-h-[60vh] overflow-y-auto">
                {isSearching ? <div className="p-4 text-center text-sm text-muted-foreground">Mencari...</div> 
                : searchResults.length > 0 ? (
                    searchResults.map(foundUser => (
                        <Link key={foundUser.uid} href={`/users/${foundUser.uid}`} onClick={() => setIsSearchOpen(false)} className="block">
                            <div className="flex items-center space-x-4 rounded-lg p-2 transition-colors hover:bg-muted">
                                <Avatar>
                                    <AvatarImage src={foundUser.photoURL || ''}/>
                                    <AvatarFallback>{foundUser.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <p className="font-medium">{foundUser.displayName}</p>
                            </div>
                        </Link>
                    ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <p>Pengguna tidak ditemukan.</p>
                  </div>
                )}
            </div>
        </Card>
      )}
       
      <Drawer open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader>
              <DrawerTitle>Notifikasi</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 pb-0 max-h-[70vh] overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map(notif => (
                  <div key={notif.id} onClick={() => handleNotificationClick(notif)}
                       className={cn("p-3 mb-2 border-l-4 rounded-r-md cursor-pointer hover:bg-muted/50",
                       notif.read ? 'border-transparent' : 'border-primary bg-primary/10'
                       )}>
                      <p className="font-semibold text-sm">{notif.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Tidak ada notifikasi.</p>
              )}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Tutup</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

       <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent>
            {selectedNotification && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedNotification.title}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <div className="py-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedNotification.message.replace(/\n/g, '<br />') }}></div>
                </DialogBody>
                <DialogFooter>
                  <Button onClick={handleDialogClose}>Tutup</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
    </>
  );
}
