
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Landmark, Check, ChevronsUpDown, ArrowLeft } from 'lucide-react';
import type { AppUser, DuesPayment } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { cn } from '@/lib/utils';
import Link from 'next/link';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());


const duesSchema = z.object({
  userId: z.string().min(1, "Warga harus dipilih."),
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
  month: z.string().min(1, "Bulan harus dipilih."),
  year: z.string().min(1, "Tahun harus dipilih."),
  notes: z.string().optional(),
});

type DuesFormValues = z.infer<typeof duesSchema>;

export default function RecordDuesPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ id: string, name: string } | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { toast } = useToast();

  const form = useForm<DuesFormValues>({
    resolver: zodResolver(duesSchema),
    defaultValues: { userId: '', amount: 0, month: months[new Date().getMonth()], year: currentYear.toString(), notes: '' },
  });
  
  const selectedUserId = form.watch('userId');
  const selectedUser = users.find(u => u.uid === selectedUserId);

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id) {
        setStaffInfo(info);
    }
    
    // Fetch users
    const usersQuery = query(collection(db, "users"), orderBy("displayName"));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
       setLoading(false);
    });

    return () => {
        unsubUsers();
    };
  }, []);

  const onSubmit = async (values: DuesFormValues) => {
    if (!staffInfo) {
        toast({ variant: 'destructive', title: "Gagal", description: "Informasi petugas tidak ditemukan." });
        return;
    }
    setIsSubmitting(true);
    const userToSave = users.find(u => u.uid === values.userId);
    if (!userToSave) {
        toast({ variant: 'destructive', title: "Gagal", description: "Data warga tidak ditemukan." });
        setIsSubmitting(false);
        return;
    }

    // Check for duplicate payment
    const q = query(
        collection(db, 'dues'),
        where('userId', '==', values.userId),
        where('month', '==', values.month),
        where('year', '==', values.year)
    );
    const existingPayment = await getDocs(q);
    if (!existingPayment.empty) {
        toast({ variant: 'destructive', title: "Gagal", description: `Warga ini sudah membayar iuran untuk ${values.month} ${values.year}.` });
        setIsSubmitting(false);
        return;
    }

    try {
      await addDoc(collection(db, 'dues'), {
        ...values,
        userName: userToSave.displayName,
        paymentDate: serverTimestamp(),
        recordedBy: staffInfo.name,
        recordedById: staffInfo.id,
      });
      toast({ title: "Berhasil", description: "Pembayaran iuran berhasil dicatat." });
      form.reset({ userId: '', amount: 0, month: months[new Date().getMonth()], year: currentYear.toString(), notes: '' });
      setSearchValue("");
      form.setValue('userId','');
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat mencatat iuran." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUserSelect = (uid: string) => {
    form.setValue("userId", uid);
    const user = users.find(u => u.uid === uid);
    setSearchValue(user?.displayName || '');
    setComboboxOpen(false);
  }

  return (
    <Card>
        <CardHeader>
             <Button variant="outline" size="sm" className="w-fit" asChild>
                  <Link href="/petugas/dues"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
              </Button>
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Pilih Warga</FormLabel>
                        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Input
                                  placeholder="Ketik nama warga untuk mencari..."
                                  value={searchValue}
                                  onChange={(e) => setSearchValue(e.target.value)}
                                  onClick={() => setComboboxOpen(true)}
                                />
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandList>
                                        {searchValue && users.filter(user => user.displayName?.toLowerCase().includes(searchValue.toLowerCase())).length === 0 && (
                                            <CommandEmpty>Warga tidak ditemukan.</CommandEmpty>
                                        )}
                                        {searchValue && (
                                            <CommandGroup>
                                                {users
                                                  .filter(user => user.displayName?.toLowerCase().includes(searchValue.toLowerCase()))
                                                  .map((user) => (
                                                    <CommandItem
                                                        value={user.displayName || user.uid}
                                                        key={user.uid}
                                                        onSelect={() => handleUserSelect(user.uid)}
                                                    >
                                                        <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            user.uid === field.value
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                        )}
                                                        />
                                                        <div>
                                                           <p>{user.displayName}</p>
                                                           <p className="text-xs text-muted-foreground">{user.email}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="month" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bulan</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                        <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tahun</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                    <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Jumlah (Rp)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Catatan (Opsional)</FormLabel>
                        <FormControl><Textarea {...field} rows={2} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
            <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
                    Simpan Pembayaran
                </Button>
            </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
