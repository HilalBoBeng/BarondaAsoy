
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { FileDown, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { ScheduleEntry, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
    'Tanpa Keterangan': { className: 'bg-red-100 text-red-800', label: 'Tanpa Keterangan' },
};


export default function AttendancePage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const { toast } = useToast();

  useEffect(() => {
    const staffQuery = query(collection(db, "staff"));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        staffData.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(staffData);
    });

    const scheduleQuery = query(collection(db, 'schedules'), orderBy('date', 'desc'));
    const unsubSchedule = onSnapshot(scheduleQuery, (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate(),
            patrolStartTime: doc.data().patrolStartTime ? (doc.data().patrolStartTime as Timestamp).toDate() : undefined,
            patrolEndTime: doc.data().patrolEndTime ? (doc.data().patrolEndTime as Timestamp).toDate() : undefined,
        } as ScheduleEntry)));
        setLoading(false);
    });

    return () => {
        unsubStaff();
        unsubSchedule();
    };
  }, []);

  const calculatePunctuality = (schedule: ScheduleEntry) => {
    if (!schedule.patrolStartTime || !schedule.time) return { start: null, end: null };

    const [startTimeStr] = schedule.time.split(' - ');
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    const scheduleDate = schedule.date as Date;
    const expectedStartTime = new Date(scheduleDate);
    expectedStartTime.setHours(startHour, startMinute, 0, 0);

    const actualStartTime = schedule.patrolStartTime as Date;
    const diffMinutes = Math.round((actualStartTime.getTime() - expectedStartTime.getTime()) / 60000);

    let startStatus;
    if (diffMinutes <= 0) {
      startStatus = { text: `Lebih Cepat ${-diffMinutes} mnt`, color: 'text-green-600' };
    } else {
      startStatus = { text: `Terlambat ${diffMinutes} mnt`, color: 'text-red-600' };
    }
     if (diffMinutes === 0) {
      startStatus = { text: 'Tepat Waktu', color: 'text-green-600' };
    }

    return { start: startStatus, end: null }; // End logic can be added later if needed
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
        const scheduleDate = schedule.date instanceof Date ? schedule.date : (schedule.date as Timestamp).toDate();
        const staffMatch = selectedStaff === 'all' || schedule.officerId === selectedStaff;
        const monthMatch = months[scheduleDate.getMonth()] === selectedMonth;
        const yearMatch = scheduleDate.getFullYear().toString() === selectedYear;
        const statusMatch = selectedStatus === 'all' || schedule.status === selectedStatus;
        return staffMatch && monthMatch && yearMatch && statusMatch;
    });
  }, [schedules, selectedStaff, selectedMonth, selectedYear, selectedStatus]);
  
  const handleExportCsv = () => {
    if (filteredSchedules.length === 0) {
        toast({ variant: 'destructive', title: 'Tidak Ada Data', description: 'Tidak ada data untuk diekspor.' });
        return;
    }
    
    const headers = ["Tanggal Patroli", "Nama Petugas", "Area Tugas", "Jam Tugas", "Status Kehadiran"];
    const csvRows = [
        headers.join(','),
        ...filteredSchedules.map(s => {
            const row = [
                format(s.date as Date, "yyyy-MM-dd", { locale: id }),
                `"${s.officer}"`,
                `"${s.area}"`,
                `"${s.time}"`,
                `"${statusConfig[s.status]?.label || s.status}"`
            ];
            return row.join(',');
        })
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daftar_hadir_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportPdf = () => {
    if (filteredSchedules.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak Ada Data', description: 'Tidak ada data untuk diekspor.' });
      return;
    }

    const doc = new jsPDF();
    const logoImg = new Image();
    logoImg.src = 'https://iili.io/KJ4aGxp.png'; // Make sure this is accessible, or use a base64 string.
    
    logoImg.onload = () => {
        doc.addImage(logoImg, 'PNG', 14, 10, 20, 20);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Laporan Kehadiran Petugas Baronda', 40, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Periode: ${selectedMonth} ${selectedYear}`, 40, 26);

        (doc as any).autoTable({
            startY: 40,
            head: [['Tanggal Patroli', 'Nama Petugas', 'Area Tugas', 'Jam Tugas', 'Status Kehadiran']],
            body: filteredSchedules.map(s => [
                format(s.date as Date, "d MMMM yyyy", { locale: id }),
                s.officer,
                s.area,
                s.time,
                statusConfig[s.status]?.label || s.status
            ]),
            theme: 'grid',
            headStyles: { fillColor: [255, 116, 38] }, // Orange color for header
            styles: { font: 'helvetica', fontSize: 9 },
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Dicetak pada: ${format(new Date(), 'PPP p', { locale: id })}`, 14, doc.internal.pageSize.height - 10);
            doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
        }

        doc.save(`daftar_hadir_${selectedMonth}_${selectedYear}.pdf`);
    };

    logoImg.onerror = () => {
        toast({ variant: 'destructive', title: 'Gagal Memuat Logo', description: 'Tidak dapat memuat logo untuk PDF.' });
    };
  };

  const renderPunctuality = (schedule: ScheduleEntry) => {
    const punctuality = calculatePunctuality(schedule);
    if (!punctuality.start) return <TableCell>-</TableCell>;

    const Icon = punctuality.start.text.includes('Cepat') || punctuality.start.text.includes('Tepat') ? CheckCircle : AlertCircle;
    
    return (
        <TableCell>
            <div className={cn("flex items-center gap-1 text-xs", punctuality.start.color)}>
                <Icon className="h-3 w-3" />
                <span>{punctuality.start.text}</span>
            </div>
        </TableCell>
    )
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Hadir Petugas</CardTitle>
        <CardDescription>Lacak dan ekspor catatan kehadiran petugas patroli.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/50 items-end">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
             <div className="space-y-2">
                 <label className="text-sm font-medium">Filter Status</label>
                 <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="Completed">Hadir</SelectItem>
                        <SelectItem value="In Progress">Berlangsung</SelectItem>
                        <SelectItem value="Izin">Izin</SelectItem>
                        <SelectItem value="Sakit">Sakit</SelectItem>
                        <SelectItem value="Pending">Belum Absen</SelectItem>
                        <SelectItem value="Tanpa Keterangan">Tanpa Keterangan</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="flex justify-end mb-4">
             <div className="flex gap-2">
                <Button onClick={handleExportCsv} variant="outline">
                    <FileDown className="mr-2" /> Ekspor CSV
                </Button>
                <Button onClick={handleExportPdf} variant="outline">
                    <FileDown className="mr-2" /> Ekspor PDF
                </Button>
             </div>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Patroli</TableHead>
                  <TableHead>Nama Petugas</TableHead>
                  <TableHead>Ketepatan Waktu</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSchedules.length > 0 ? (
                  filteredSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{format(schedule.date as Date, "PPP", { locale: id })}</TableCell>
                      <TableCell>{schedule.officer}</TableCell>
                      {renderPunctuality(schedule)}
                      <TableCell>
                        <Badge variant="secondary" className={cn(statusConfig[schedule.status]?.className)}>
                            {statusConfig[schedule.status]?.label || schedule.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Tidak ada data kehadiran untuk filter yang dipilih.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
