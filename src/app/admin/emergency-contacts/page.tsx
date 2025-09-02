
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Phone } from 'lucide-react';
import type { EmergencyContact } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const contactSchema = z.object({
  name: z.string().min(1, "Nama kontak tidak boleh kosong."),
  number: z.string().min(3, "Nomor telepon tidak valid."),
  type: z.enum(['police', 'fire', 'medical', 'other'], { required_error: "Tipe kontak harus dipilih." }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function EmergencyContactsAdminPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [currentContact, setCurrentContact] = useState<EmergencyContact | null>(null);
  const { toast } = useToast();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', number: '', type: 'other' },
  });

  useEffect(() => {
    const q = query(collection(db, 'emergency_contacts'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmergencyContact[];
      setContacts(contactsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching contacts:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (isDialogOpen) {
      form.reset(currentContact || { name: '', number: '', type: 'other' });
    }
  }, [isDialogOpen, currentContact, form]);

  const handleDialogOpen = (contact: EmergencyContact | null = null) => {
    setCurrentContact(contact);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      if (currentContact) {
        const docRef = doc(db, 'emergency_contacts', currentContact.id);
        await updateDoc(docRef, values);
        toast({ title: "Berhasil", description: "Kontak berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'emergency_contacts'), values);
        toast({ title: "Berhasil", description: "Kontak berhasil ditambahkan." });
      }
      setIsDialogOpen(false);
      setCurrentContact(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'emergency_contacts', id));
      toast({ title: "Berhasil", description: "Kontak berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus kontak." });
    } finally {
      setIsDeleting(null);
    }
  };

  const renderActions = (contact: EmergencyContact) => (
      <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => handleDialogOpen(contact)} disabled={isSubmitting || !!isDeleting}>
              <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isSubmitting || !!isDeleting}>
                    {isDeleting === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-lg">
                  <AlertDialogHeader>
                      <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                      <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(contact.id)}>Hapus</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Manajemen Kontak Darurat</CardTitle>
          <CardDescription>Tambah, edit, atau hapus kontak penting.</CardDescription>
        </div>
        <Button onClick={() => handleDialogOpen()} disabled={isSubmitting || !!isDeleting}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Tambah Kontak
        </Button>
      </CardHeader>
      <CardContent>
          {/* Mobile View */}
          <div className="sm:hidden grid grid-cols-1 gap-4">
              {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : contacts.length > 0 ? (
                  contacts.map((contact) => (
                      <Card key={contact.id}>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                               <CardTitle className="text-base">{contact.name}</CardTitle>
                               {renderActions(contact)}
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-bold text-primary">{contact.number}</p>
                            <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                                <a href={`tel:${contact.number}`}><Phone className="mr-2 h-4 w-4" /> Telepon</a>
                            </Button>
                          </CardContent>
                      </Card>
                  ))
              ) : (
                  <div className="text-center py-12 text-muted-foreground">Belum ada kontak darurat yang ditambahkan.</div>
              )}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block rounded-lg border">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Nomor Telepon</TableHead>
                    <TableHead className="text-right w-[100px]">Aksi</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-[88px] ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : contacts.length > 0 ? (
                    contacts.map((contact) => (
                    <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.number}</TableCell>
                        <TableCell className="text-right">{renderActions(contact)}</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                        Belum ada kontak darurat yang ditambahkan.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
            <DialogHeader>
              <DialogTitle>{currentContact ? 'Edit' : 'Tambah'} Kontak</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nama Kontak</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem><FormLabel>Nomor Telepon</FormLabel><FormControl><Input {...field} type="tel" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tipe Kontak</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="police">Polisi</SelectItem>
                                <SelectItem value="fire">Pemadam Kebakaran</SelectItem>
                                <SelectItem value="medical">Medis/Ambulans</SelectItem>
                                <SelectItem value="other">Lainnya</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
