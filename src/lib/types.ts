
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

export interface Report {
  id: string;
  reporterName: string;
  reportText: string;
  category: string;
  userId?: string;
  createdAt: string | Date | Timestamp;
  triageResult: TriageReportOutput;
  status: 'new' | 'in_progress' | 'resolved';
}
