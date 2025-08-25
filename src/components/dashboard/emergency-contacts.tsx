"use client";

import { Phone, Shield, Flame, HeartPulse, Building } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { emergencyContacts } from '@/lib/mock-data';
import type { EmergencyContact } from '@/lib/types';

const iconMap: Record<EmergencyContact['type'], React.ReactElement> = {
  police: <Shield className="h-8 w-8 text-accent" />,
  fire: <Flame className="h-8 w-8 text-destructive" />,
  medical: <HeartPulse className="h-8 w-8 text-green-500" />,
  other: <Building className="h-8 w-8 text-muted-foreground" />,
};

export default function EmergencyContacts() {
  return (
    <div className="grid gap-6">
       <div className="flex items-center">
        <h1 className="text-2xl font-bold">Emergency Contacts</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {emergencyContacts.map((contact) => (
          <Card key={contact.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                {contact.name}
              </CardTitle>
              {iconMap[contact.type]}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{contact.number}</div>
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <a href={`tel:${contact.number}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
