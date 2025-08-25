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

const stats = [
    { title: "Active Reports", value: "3", icon: Shield },
    { title: "Announcements", value: "5", icon: Megaphone },
    { title: "Officers on Duty", value: "4", icon: Users },
    { title: "Patrols Today", value: "8", icon: CalendarCheck },
];

export default function MainDashboardView() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome, User!</h1>
        <p className="text-muted-foreground">Here's what's happening in your neighborhood today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
            <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
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
