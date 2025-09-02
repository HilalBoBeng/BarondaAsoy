
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import type { EmergencyContact } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';

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

    const renderSkeleton = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                </Card>
            ))}
        </div>
    );


  return (
    <div>
      {loading ? (
        renderSkeleton()
        ) : contacts.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          Tidak ada kontak darurat yang ditambahkan.
        </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((contact) => (
            <Card key={contact.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="font-semibold text-sm">{contact.name}</p>
                            <p className="text-muted-foreground text-xs">{contact.number}</p>
                        </div>
                    </div>
                    <Button size="icon" variant="outline" asChild>
                       <a href={`tel:${contact.number}`}>
                           <Phone className="h-4 w-4" />
                           <span className="sr-only">Telepon {contact.name}</span>
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
