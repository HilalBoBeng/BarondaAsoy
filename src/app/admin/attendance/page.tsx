
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp, getDocs, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Filter } from 'lucide-react';
import type { ScheduleEntry, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const statusConfig: Record<string, { className: string; label: string }> = {
    'Completed': { className: 'bg-green-100 text-green-800', label: 'Hadir' },
    'Izin': { className: 'bg-yellow-100 text-yellow-800', label: 'Izin' },
    'Sakit': { className: 'bg-orange-100 text-orange-800', label: 'Sakit' },
    'Pending': { className: 'bg-gray-100 text-gray-800', label: 'Belum Absen' },
    'In Progress': { className: 'bg-blue-100 text-blue-800', label: 'Berlangsung' },
};


export default function AttendancePage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const { toast } = useToast();

  useEffect(() => {
    const staffQuery = query(collection(db, "staff"), where('status', '==', 'active'));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        // Sort client-side to avoid composite index
        staffData.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(staffData);
    });

    const scheduleQuery = query(collection(db, 'schedules'), orderBy('date', 'desc'));
    const unsubSchedule = onSnapshot(scheduleQuery, (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate(),
        } as ScheduleEntry)));
        setLoading(false);
    });

    return () => {
        unsubStaff();
        unsubSchedule();
    };
  }, []);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
        const scheduleDate = schedule.date instanceof Date ? schedule.date : (schedule.date as Timestamp).toDate();
        const staffMatch = selectedStaff === 'all' || schedule.officerId === selectedStaff;
        const monthMatch = months[scheduleDate.getMonth()] === selectedMonth;
        const yearMatch = scheduleDate.getFullYear().toString() === selectedYear;
        return staffMatch && monthMatch && yearMatch;
    });
  }, [schedules, selectedStaff, selectedMonth, selectedYear]);

  const handleExport = (type: 'csv' | 'pdf') => {
    toast({
        title: 'Fitur Dalam Pengembangan',
        description: `Fungsi ekspor ke ${type.toUpperCase()} akan segera tersedia.`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Hadir Petugas</CardTitle>
        <CardDescription>Lacak dan ekspor catatan kehadiran petugas patroli.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
            <div className="flex-1 space-y-2">
                 <label className="text-sm font-medium">Filter Petugas</label>
                 <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih petugas..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Petugas</SelectItem>
                        {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1 space-y-2">
                 <label className="text-sm font-medium">Filter Periode</label>
                 <div className="flex gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih bulan..." />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih tahun..." />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>
            </div>
            <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Opsi Ekspor</label>
                 <div className="flex gap-2">
                    <Button onClick={() => handleExport('csv')} className="w-full">
                        <FileDown className="mr-2" /> CSV
                    </Button>
                    <Button onClick={() => handleExport('pdf')} className="w-full">
                        <FileDown className="mr-2" /> PDF
                    </Button>
                 </div>
            </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal Patroli</TableHead>
                <TableHead>Nama Petugas</TableHead>
                <TableHead>Area Tugas</TableHead>
                <TableHead>Jam Tugas</TableHead>
                <TableHead className="text-right">Status Kehadiran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSchedules.length > 0 ? (
                filteredSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{format(schedule.date as Date, "PPP", { locale: id })}</TableCell>
                    <TableCell>{schedule.officer}</TableCell>
                    <TableCell>{schedule.area}</TableCell>
                    <TableCell>{schedule.time}</TableCell>
                    <TableCell className="text-right">
                       <Badge variant="secondary" className={cn(statusConfig[schedule.status]?.className)}>
                          {statusConfig[schedule.status]?.label || schedule.status}
                       </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Tidak ada data kehadiran untuk filter yang dipilih.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
