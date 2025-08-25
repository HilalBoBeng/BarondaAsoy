"use client";

import { Shield, Megaphone, Users, CalendarCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ReportActivity from './report-activity';
import Schedule from './schedule';
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Skeleton } from "../ui/skeleton";

export default function MainDashboardView() {
    const [stats, setStats] = useState({
        activeReports: 0,
        announcements: 0,
        officersOnDuty: 0,
        patrolsToday: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const collections = {
            reports: collection(db, 'reports'),
            announcements: collection(db, 'announcements'),
            schedules: collection(db, 'schedules'),
        }

        const unsubscribes = [
            onSnapshot(query(collections.reports, where('triageResult.threatLevel', 'in', ['medium', 'high'])), snapshot => {
                setStats(prev => ({...prev, activeReports: snapshot.size}));
            }),
            onSnapshot(collections.announcements, snapshot => {
                setStats(prev => ({...prev, announcements: snapshot.size}));
            }),
            onSnapshot(query(collections.schedules, where('status', '==', 'In Progress')), snapshot => {
                setStats(prev => ({...prev, officersOnDuty: snapshot.size}));
            }),
            onSnapshot(query(collections.schedules, where('date', '>=', today)), snapshot => {
                setStats(prev => ({...prev, patrolsToday: snapshot.size}));
            }),
        ];
        
        Promise.all(unsubscribes).then(() => setLoading(false));

        return () => unsubscribes.forEach(unsub => unsub());

    }, []);

    const statCards = [
        { title: "Active Reports", value: stats.activeReports, icon: Shield },
        { title: "Announcements", value: stats.announcements, icon: Megaphone },
        { title: "Officers on Duty", value: stats.officersOnDuty, icon: Users },
        { title: "Patrols Today", value: stats.patrolsToday, icon: CalendarCheck },
    ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome, User!</h1>
        <p className="text-muted-foreground">Here's what's happening in your neighborhood today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
            Array.from({length: 4}).map((_, index) => (
                 <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-1/3" />
                    </CardContent>
                </Card>
            ))
        ) : (
            statCards.map((stat, index) => (
                <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
            </Card>
            ))
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="mb-4 text-2xl font-bold">Submit a Report</h2>
          <ReportActivity />
        </div>
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-2xl font-bold">Today's Patrols</h2>
          <div className="max-h-[500px] overflow-auto">
            <Schedule />
          </div>
        </div>
      </div>
    </div>
  );
}
