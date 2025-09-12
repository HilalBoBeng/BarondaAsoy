
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { Home, UserCircle, Settings, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { app, db } from "@/lib/firebase/client";
import type { AppUser } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { UserNav } from "@/components/dashboard/user-nav";
import WelcomeAnnouncement from "@/components/dashboard/welcome-announcement";


const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/report", icon: Shield, label: "Laporan" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
]

function LoadingScreen() {
    return (
        <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background")}>
            <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Loading Logo" 
                width={120} 
                height={120} 
                className="animate-logo-pulse"
                priority
            />
        </div>
    );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const auth = getAuth(app);

    const [user, setUser] = useState<User | null>(null);
    const [userInfo, setUserInfo] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const OneSignal = (window as any).OneSignal || [];
        const handleOneSignalLogin = async (userId: string) => {
            if (OneSignal.isInitialized) {
                try {
                    await OneSignal.login(userId);
                } catch (e) {
                    console.error("OneSignal login error:", e);
                }
            } else {
                 OneSignal.push(() => {
                    OneSignal.login(userId).catch((e: any) => console.error("OneSignal deferred login error:", e));
                 });
            }
        };

        const handleOneSignalLogout = () => {
             if (OneSignal.isInitialized) {
                OneSignal.logout();
            }
        };

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                handleOneSignalLogin(currentUser.uid);

                const userDocRef = doc(db, 'users', currentUser.uid);
                const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
                    if (userDocSnap.exists()) {
                        setUserInfo({ uid: currentUser.uid, ...userDocSnap.data() } as AppUser);
                    } else {
                        setUserInfo(null);
                    }
                    setLoading(false);
                });
                return () => unsubscribeUser();
            } else {
                handleOneSignalLogout();
                router.push('/auth/login');
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, [auth, router]);

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40">
            <WelcomeAnnouncement />
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
                <div className="flex items-center gap-2 text-left">
                    <Image 
                        src="https://iili.io/KJ4aGxp.png" 
                        alt="Logo" 
                        width={32} 
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex flex-col">
                        <span className="text-base font-bold text-primary leading-tight">Baronda</span>
                        <p className="text-xs text-muted-foreground leading-tight">Kelurahan Kilongan</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <UserNav user={user} userInfo={userInfo} />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 animate-fade-in-up">
                <div className="mx-auto w-full max-w-screen-2xl">
                    {children}
                </div>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
                <div className="grid h-16 grid-cols-4 items-center justify-center gap-2 px-2">
                    {navItems.map(item => (
                        <Link key={item.href} href={item.href} passHref>
                            <Button variant="ghost" className={cn(
                                "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                                pathname === item.href ? "text-primary bg-primary/10" : "text-muted-foreground"
                            )}>
                                <item.icon className="h-5 w-5" />
                                <span>{item.label}</span>
                            </Button>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
