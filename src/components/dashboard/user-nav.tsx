
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
import { LogIn, LogOut, UserPlus, Settings, User as UserIcon, Search, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { getAuth, signOut, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import type { AppUser } from "@/lib/types";

export function UserNav({ user, userInfo }: { user: User | null; userInfo: AppUser | null }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Keluar",
        description: "Terjadi kesalahan saat mencoba keluar.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      try {
          const usersRef = collection(db, "users");
          const q = query(
              usersRef,
              where('displayName', '>=', searchQuery),
              where('displayName', '<=', searchQuery + '\uf8ff'),
              limit(10)
          );
          const querySnapshot = await getDocs(q);
          const results = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
          setSearchResults(results);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Pencarian Gagal' });
      } finally {
          setIsSearching(false);
      }
  };

  return (
    <>
      <div className="flex items-center gap-2">
         {user && (
          <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>
         )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User profile'} />
                <AvatarFallback>
                  <UserIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            {user ? (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none truncate">{user.displayName || "Pengguna"}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profil Saya</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/chat"><MessageSquare className="mr-2 h-4 w-4" /><span>Pesan</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 h-4 w-4" /><span>Pengaturan</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                  {isLoggingOut && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem asChild><Link href="/auth/login"><LogIn className="mr-2 h-4 w-4" /><span>Masuk</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/auth/register"><UserPlus className="mr-2 h-4 w-4" /><span>Daftar</span></Link></DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

       <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Cari Warga</DialogTitle>
                  <DialogDescription>Cari warga lain untuk melihat profil atau memulai percakapan.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSearch}>
                  <div className="flex gap-2">
                      <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Masukkan nama..."/>
                      <Button type="submit" disabled={isSearching}>
                          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                  </div>
              </form>
              <DialogBody className="mt-4 max-h-[50vh] overflow-y-auto">
                 <div className="space-y-2">
                    {searchResults.length > 0 ? searchResults.map(foundUser => (
                         <Link key={foundUser.uid} href={`/users/${foundUser.uid}`} onClick={() => setIsSearchOpen(false)} className="block">
                             <div className="flex items-center space-x-4 rounded-lg p-2 transition-colors hover:bg-muted">
                                 <Avatar>
                                     <AvatarImage src={foundUser.photoURL || ''}/>
                                     <AvatarFallback>{foundUser.displayName?.charAt(0)}</AvatarFallback>
                                 </Avatar>
                                 <p className="font-medium">{foundUser.displayName}</p>
                             </div>
                         </Link>
                    )) : (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            {isSearching ? 'Mencari...' : 'Tidak ada hasil ditemukan.'}
                        </p>
                    )}
                 </div>
              </DialogBody>
          </DialogContent>
      </Dialog>
    </>
  );
}
