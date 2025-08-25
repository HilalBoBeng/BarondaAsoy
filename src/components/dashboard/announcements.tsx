"use client";

import { Megaphone, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { announcements } from '@/lib/mock-data';

export default function Announcements() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Community Announcements</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{announcement.title}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{announcement.date}</span>
                  </CardDescription>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Megaphone className="h-6 w-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground">{announcement.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
