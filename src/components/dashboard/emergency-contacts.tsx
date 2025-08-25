"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Phone, Shield, Flame, HeartPulse, Building } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import type { EmergencyContact } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

const iconMap: Record<EmergencyContact['type'], React.ReactElement> = {
  police: <Shield className="h-8 w-8 text-accent" />,
  fire: <Flame className="h-8 w-8 text-destructive" />,
  medical: <HeartPulse className="h-8 w-8 text-green-500" />,
  other: <Building className="h-8 w-8 text-muted-foreground" />,
};

export default function EmergencyContacts() {
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'emergency_contacts'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const contactsData: EmergencyContact[] = [];
            querySnapshot.forEach((doc) => {
                contactsData.push({ id: doc.id, ...doc.data() } as EmergencyContact);
            });
            setContacts(contactsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);


  return (
    <div className="grid gap-6">
       <div className="flex items-center">
        <h1 className="text-2xl font-bold">Kontak Darurat</h1>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-6 w-3/4" />
                         <Skeleton className="h-8 w-8 rounded-full" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-1/2 mt-2" />
                        <Skeleton className="h-10 w-full mt-4" />
                    </CardContent>
                </Card>
            ))}
        </div>
        ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {contacts.map((contact) => (
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
                        Telepon Sekarang
                        </a>
                    </Button>
                    </CardContent>
                </Card>
                ))}
            </div>
      )}
    </div>
  );
}
