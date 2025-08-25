
import { Timestamp } from "firebase/firestore";
import type { TriageReportOutput } from "@/ai/flows/triage-report";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string | Date | Timestamp;
}

export interface ScheduleEntry {
  id: string;
  date: string | Date | Timestamp;
  time: string;
  officer: string;
  area: string;
  status: 'Completed' | 'Pending' | 'In Progress';
}

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  type: 'police' | 'fire' | 'medical' | 'other';
}

export interface Reply {
    message: string;
    replierRole: 'Admin' | 'Petugas';
    timestamp: Date | Timestamp;
}

export interface Report {
  id: string;
  reporterName: string;
  reporterEmail?: string;
  reportText: string;
  category: 'theft' | 'vandalism' | 'suspicious_person' | 'other';
  userId?: string;
  createdAt: string | Date | Timestamp;
  triageResult: TriageReportOutput;
  status: 'new' | 'in_progress' | 'resolved';
  replies?: Reply[];
}

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: string;
  isBlocked?: boolean;
  blockReason?: string;
  blockStarts?: string;
  blockEnds?: string;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  accessCode: string;
}

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    createdAt: Timestamp;
    read: boolean;
    link?: string;
}
