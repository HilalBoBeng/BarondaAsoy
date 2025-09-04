
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Shield, Megaphone, Users, UserCheck, Calendar, User, FileText, ClipboardList, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Report, PatrolLog, Notification } from "@/lib/types";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export default function AdminPage() {
    const [stats, setStats] = useState({
        activeReports: 0,
        totalUsers: 0,
        officersOnDuty: 0,
        totalAnnouncements: 0,
    });
    const [recentReports, setRecentReports] = useState<Report[]>([]);
    const [recentPatrolLogs, setRecentPatrolLogs] = useState<PatrolLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingReports, setLoadingReports] = useState(true);
    const [loadingPatrolLogs, setLoadingPatrolLogs] = useState(true);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    const [greeting, setGreeting] = useState("Selamat Datang");
    const [currentTime, setCurrentTime] = useState("");
    const [currentDate, setCurrentDate] = useState("");
    const [adminName, setAdminName] = useState<string | null>(null);
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
            setAdminName(staffInfo.name);
        } else {
            setAdminName("Admin");
        }
        setLoadingName(false);


        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let mounted = true;

        // Fetch stats
        const reportsQuery = query(collection(db, "reports"), where('status', '!=', 'resolved'));
        const usersQuery = collection(db, "users");
        const scheduleQuery = query(collection(db, 'schedules'), where('status', '==', 'In Progress'));
        const announcementsQuery = collection(db, "announcements");

        const unsubStats = [
            onSnapshot(reportsQuery, (snapshot) => { if(mounted) setStats(prev => ({ ...prev, activeReports: snapshot.size })) }),
            onSnapshot(scheduleQuery, (snapshot) => { if(mounted) setStats(prev => ({...prev, officersOnDuty: snapshot.size})) }),
            onSnapshot(announcementsQuery, (snapshot) => { if(mounted) setStats(prev => ({ ...prev, totalAnnouncements: snapshot.size })) }),
        ];
        
        getDocs(usersQuery).then(snapshot => {
            if(mounted) {
                setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
            }
        }).finally(() => {
            if(mounted) setLoadingStats(false);
        });

        // Fetch recent reports
        const recentReportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(5));
        const unsubReports = onSnapshot(recentReportsQuery, (snapshot) => {
             if (mounted) {
                const reports = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate().toLocaleDateString('id-ID')
                })) as Report[];
                setRecentReports(reports);
                setLoadingReports(false);
            }
        });
        
        // Fetch recent patrol logs
        const recentPatrolLogsQuery = query(collection(db, "patrol_logs"), orderBy("createdAt", "desc"), limit(5));
        const unsubPatrolLogs = onSnapshot(recentPatrolLogsQuery, (snapshot) => {
             if (mounted) {
                const logs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate().toLocaleString('id-ID', {dateStyle: 'medium', timeStyle: 'short'})
                })) as PatrolLog[];
                setRecentPatrolLogs(logs);
                setLoadingPatrolLogs(false);
            }
        });
        
        // Fetch notifications for admin (placeholder, adjust userId if needed)
        const notifsQuery = query(collection(db, "notifications"), where("userId", "==", "admin"), limit(5));
        const unsubNotifs = onSnapshot(notifsQuery, snapshot => {
            if(mounted) {
                const notifsData = snapshot.docs.map(doc => doc.data() as Notification);
                setNotifications(notifsData);
                setLoadingNotifications(false);
            }
        });

        return () => {
            mounted = false;
            unsubStats.forEach(unsub => unsub());
            unsubReports();
            unsubPatrolLogs();
            unsubNotifs();
        };
    }, []);

    const statCards = [
        { title: "Laporan Aktif", value: stats.activeReports, icon: Shield, color: "text-red-500" },
        { title: "Total Warga", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
        { title: "Petugas Bertugas", value: stats.officersOnDuty, icon: UserCheck, color: "text-green-500" },
        { title: "Pengumuman", value: stats.totalAnnouncements, icon: Megaphone, color: "text-yellow-500" },
    ];

    const threatLevelBadge = (report: Report) => {
        if (!report.triageResult) return <span className="text-muted-foreground text-xs">N/A</span>;
        
        const level = report.triageResult.threatLevel;
        return (
            <Badge variant={level === 'high' ? 'destructive' : level === 'medium' ? 'default' : 'secondary'} className="capitalize">
                {level}
            </Badge>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                 {loadingName ? (
                    <Skeleton className="h-8 w-64" />
                 ) : (
                     <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-word">
                        {greeting}, {adminName}!
                    </h1>
                 )}
                <p className="text-muted-foreground text-sm sm:text-base mt-1">
                    Selamat datang di Dasbor Admin Baronda.
                </p>
                <p className="text-muted-foreground text-sm sm:text-base">
                    {currentDate} | {currentTime}
                </p>
            </div>
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
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Laporan Warga Terbaru</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Mobile View */}
                        <div className="sm:hidden space-y-4">
                          {loadingReports ? (
                             Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
                          ) : recentReports.length > 0 ? (
                            recentReports.map(report => (
                              <Card key={report.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />{report.reporterName}</CardTitle>
                                        {threatLevelBadge(report)}
                                    </div>
                                    <CardDescription className="flex items-center gap-2 pt-1"><Calendar className="h-4 w-4" />{report.createdAt as string}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground break-words">{report.reportText}</p>
                                </CardContent>
                              </Card>  
                            ))
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">Belum ada laporan warga.</div>
                          )}
                        </div>
                        
                        {/* Desktop View */}
                         <div className="hidden sm:block rounded-lg border">
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
                                                <TableCell className="font-medium">{report.reporterName}</TableCell>
                                                <TableCell className="max-w-sm truncate">{report.reportText}</TableCell>
                                                <TableCell className="text-right">
                                                    {threatLevelBadge(report)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">Belum ada laporan warga.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                 <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Log Patroli Terbaru</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingPatrolLogs ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                            ) : recentPatrolLogs.length > 0 ? (
                                recentPatrolLogs.map(log => (
                                <div key={log.id} className="border-b pb-2">
                                    <p className="text-sm text-muted-foreground">{log.createdAt as string}</p>
                                    <p className="font-semibold">{log.title}</p>
                                    <p className="text-sm text-muted-foreground truncate">{log.description}</p>
                                </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">Belum ada log patroli.</div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Pemberitahuan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {loadingNotifications ? (
                                <Skeleton className="h-16 w-full" />
                            ) : notifications.length > 0 ? (
                                notifications.map(notif => (
                                <Link href={notif.link || '#'} key={notif.id} className="block border-l-4 border-primary pl-3 hover:bg-muted/50 rounded-r-md">
                                    <p className="font-semibold text-sm flex items-center gap-2"><Bell className="h-4 w-4" />{notif.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}</p>
                                </Link>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">Tidak ada pemberitahuan baru.</div>
                            )}
                        </CardContent>
                    </Card>
                 </div>
            </div>
        </div>
    );
}
