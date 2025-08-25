
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Shield, Megaphone, Users, CalendarCheck, FileText, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Report } from "@/lib/types";

export default function AdminPage() {
    const [stats, setStats] = useState({
        activeReports: 0,
        totalUsers: 0,
        officersOnDuty: 0,
        totalAnnouncements: 0,
    });
    const [recentReports, setRecentReports] = useState<Report[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingReports, setLoadingReports] = useState(true);

    useEffect(() => {
        // Fetch stats
        const reportsQuery = query(collection(db, "reports"), where('triageResult.threatLevel', 'in', ['medium', 'high']));
        const usersQuery = collection(db, "users"); // Assuming you have a 'users' collection
        const scheduleQuery = query(collection(db, 'schedules'), where('status', '==', 'In Progress'));
        const announcementsQuery = collection(db, "announcements");

        const unsubStats = [
            onSnapshot(reportsQuery, (snapshot) => setStats(prev => ({ ...prev, activeReports: snapshot.size }))),
            onSnapshot(scheduleQuery, (snapshot) => setStats(prev => ({...prev, officersOnDuty: snapshot.size}))),
            onSnapshot(announcementsQuery, (snapshot) => setStats(prev => ({ ...prev, totalAnnouncements: snapshot.size }))),
        ];

        // Fetch total users once, as it's less likely to change frequently
        getDocs(usersQuery).then(snapshot => {
            setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
        }).finally(() => setLoadingStats(false));

        // Fetch recent reports
        const recentReportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(5));
        const unsubReports = onSnapshot(recentReportsQuery, (snapshot) => {
            const reports = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate().toLocaleDateString('id-ID')
            })) as Report[];
            setRecentReports(reports);
            setLoadingReports(false);
        });

        return () => {
            unsubStats.forEach(unsub => unsub());
            unsubReports();
        };
    }, []);

    const statCards = [
        { title: "Laporan Aktif", value: stats.activeReports, icon: Shield, color: "text-red-500" },
        { title: "Total Warga", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
        { title: "Petugas Bertugas", value: stats.officersOnDuty, icon: UserCheck, color: "text-green-500" },
        { title: "Pengumuman", value: stats.totalAnnouncements, icon: Megaphone, color: "text-yellow-500" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dasbor Admin</h1>
                    <p className="text-muted-foreground">Ringkasan aktivitas dan manajemen sistem.</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {loadingStats ? (
                    Array.from({ length: 4 }).map((_, i) => (
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
                                <div className="text-2xl font-bold">{card.value}</div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
            
            {/* Recent Reports */}
            <Card>
                <CardHeader>
                    <CardTitle>Laporan Terbaru</CardTitle>
                    <CardDescription>5 laporan terakhir yang masuk dari warga.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Pelapor</TableHead>
                                    <TableHead>Laporan</TableHead>
                                    <TableHead className="text-right">Ancaman</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingReports ? (
                                     Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-6 w-20 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : recentReports.length > 0 ? (
                                    recentReports.map(report => (
                                        <TableRow key={report.id}>
                                            <TableCell>{report.createdAt as string}</TableCell>
                                            <TableCell>{report.reporterName}</TableCell>
                                            <TableCell className="max-w-sm truncate">{report.reportText}</TableCell>
                                            <TableCell className="text-right">
                                                {report.triageResult ? (
                                                    <Badge variant={report.triageResult.threatLevel === 'high' ? 'destructive' : 'secondary'}>
                                                        {report.triageResult.threatLevel}
                                                    </Badge>
                                                ) : <span className="text-muted-foreground text-xs">N/A</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Belum ada laporan.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
