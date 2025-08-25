"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { schedule } from '@/lib/mock-data';
import type { ScheduleEntry } from '@/lib/types';

const statusVariant: Record<
  ScheduleEntry['status'],
  'default' | 'secondary' | 'outline'
> = {
  Completed: 'secondary',
  Pending: 'outline',
  'In Progress': 'default',
};

export default function Schedule() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Officer</TableHead>
            <TableHead>Area</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.date}</TableCell>
              <TableCell>{entry.time}</TableCell>
              <TableCell>{entry.officer}</TableCell>
              <TableCell>{entry.area}</TableCell>
              <TableCell className="text-right">
                <Badge variant={statusVariant[entry.status]}>
                  {entry.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
