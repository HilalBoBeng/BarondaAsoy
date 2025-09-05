
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Shield, Megaphone, Users, UserCheck, Calendar, User, FileText, ClipboardList, Bell, Wallet, Banknote, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUser, FinancialTransaction } from "@/lib/types";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function BendaharaPage() {
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalExpense: 0,
        totalUsers: 0,
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [greeting, setGreeting] = useState("Selamat Datang");
    const [currentTime, setCurrentTime] = useState("");
    const [currentDate, setCurrentDate] = useState("");
    const [bendaharaName, setBendaharaName] = useState<string | null>(null);
    const [loadingName, setLoadingName] = useState(true);

    useEffect(() => {
        const getGreeting = () => {
          const hour = new Date().getHours();
          if (hour >= 5 && hour < 12) return "Selamat Pagi";
          if (hour >= 12 && hour < 15) return "Selamat Siang";
          if (hour >= 15 && hour < 19) return "Selamat Sore";
          return "Selamat Malam";
        };

        const timer = setInterval(() => {
          const now = new Date();
          setGreeting(getGreeting());
          setCurrentTime(now.toLocaleTimeString('id-ID'));
          setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        }, 1000);
        
        const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (staffInfo.name) {
            setBendaharaName(staffInfo.name);
        } else {
            setBendaharaName("Bendahara");
        }
        setLoadingName(false);


        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let mounted = true;

        // Fetch stats
        const usersQuery = collection(db, "users");
        const financeQuery = collection(db, 'financial_transactions');

        const unsubFinance = onSnapshot(financeQuery, (snapshot) => {
             if (mounted) {
                let income = 0;
                let expense = 0;
                snapshot.forEach(doc => {
                    const transaction = doc.data() as FinancialTransaction;
                    if (transaction.type === 'income') {
                        income += transaction.amount;
                    } else {
                        expense += transaction.amount;
                    }
                });
                setStats(prev => ({ ...prev, totalIncome: income, totalExpense: expense }));
            }
        });
        
        getDocs(usersQuery).then(snapshot => {
            if(mounted) {
                setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
            }
        }).finally(() => {
            if(mounted) setLoadingStats(false);
        });

        return () => {
            mounted = false;
            unsubFinance();
        };
    }, []);

    const statCards = [
        { title: "Total Pemasukan", value: stats.totalIncome, icon: Wallet, color: "text-green-500", currency: true },
        { title: "Total Pengeluaran", value: stats.totalExpense, icon: Banknote, color: "text-red-500", currency: true },
        { title: "Total Warga", value: stats.totalUsers, icon: Users, color: "text-blue-500", currency: false },
    ];
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);


    return (
        <div className="space-y-6">
            <div className="animate-fade-in-up">
                 {loadingName ? (
                    <>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-5 w-72" />
                        <Skeleton className="h-5 w-80 mt-1" />
                    </>
                 ) : (
                    <>
                     <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-word">
                        {greeting}, {bendaharaName}!
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base mt-1">
                        Selamat datang di Dasbor Bendahara Baronda.
                    </p>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        {currentDate} | {currentTime}
                    </p>
                    </>
                 )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-fade-in-up" style={{animationDelay: '200ms'}}>
                {loadingStats ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-6 w-6 rounded-sm" /></CardHeader>
                            <CardContent><Skeleton className="h-8 w-1/3" /></CardContent>
                        </Card>
                    ))
                ) : (
                    statCards.map((card, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                <card.icon className={`h-5 w-5 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.currency ? formatCurrency(card.value) : card.value}</div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
