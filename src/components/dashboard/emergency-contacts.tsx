
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import type { EmergencyContact } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export default function EmergencyContacts() {
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'emergency_contacts'), orderBy('name'));
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

    const renderSkeleton = () => (
        <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-md" />
                </div>
            ))}
        </div>
    );


  return (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg">Kontak Darurat</CardTitle>
        </CardHeader>
        <CardContent>
         {loading ? (
            renderSkeleton()
            ) : contacts.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              Tidak ada kontak darurat.
            </div>
            ) : (
            <div className="space-y-3">
                {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <p className="font-semibold text-sm">{contact.name}</p>
                            <p className="text-muted-foreground text-xs">{contact.number}</p>
                        </div>
                        <Button size="icon" variant="outline" asChild className="bg-accent text-accent-foreground">
                        <a href={`tel:${contact.number}`}>
                            <Phone className="h-4 w-4" />
                            <span className="sr-only">Telepon {contact.name}</span>
                        </a>
                        </Button>
                    </div>
                ))}
            </div>
        )}
        </CardContent>
    </Card>
  );
}
