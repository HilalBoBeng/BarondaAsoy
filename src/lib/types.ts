import { Timestamp } from "firebase/firestore";

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
