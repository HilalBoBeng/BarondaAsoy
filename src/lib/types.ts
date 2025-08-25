
import { Timestamp } from "firebase/firestore";
import type { TriageReportOutput } from "@/ai/flows/triage-report";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string | Date | Timestamp;
  target?: 'all' | 'users' | 'staff';
  likes?: number;
  dislikes?: number;
  likesBy?: string[];
  dislikesBy?: string[];
}

export interface ScheduleEntry {
  id:string;
  date: string | Date | Timestamp;
  time: string;
  officer: string;
  officerId: string;
  area: string;
  status: 'Completed' | 'Pending' | 'In Progress' | 'Izin' | 'Sakit' | 'Pending Review';
  reason?: string; // For Izin or Sakit
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
  replies?: Reply[] | Record<string, Reply>;
  handlerName?: string;
  handlerId?: string;
}

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  addressType: 'kilongan' | 'luar_kilongan';
  addressDetail: string;
  accessCode: string;
  status: 'pending' | 'active' | 'rejected';
  points?: number;
}

export interface Notification {
    id: string;
    userId: string; // Can be user UID, staff ID, 'all_users', or 'all_staff'
    title: string;
    message: string;
    createdAt: Timestamp | Date;
    read: boolean;
    link?: string;
    recipientName?: string; 
    recipientEmail?: string; 
}

export interface PatrolLog {
  id: string;
  officerName: string;
  officerId: string;
  title: string;
  description: string;
  photoURL?: string;
  createdAt: Timestamp | Date;
}

export interface EquipmentStatus {
    id: string; // e.g., 'senter', 'borgol'
    name: string;
    status: 'good' | 'broken' | 'missing';
    lastChecked: Timestamp | Date;
    notes: string;
    checkedBy?: string;
}

// New type for Change Email Flow
export interface ChangeEmailContext {
  flow: 'changeEmail';
  userId: string;
  newEmail: string;
  // We don't store password directly in localStorage for safety.
  // It's used once and then discarded.
}

export interface ChangeStaffEmailContext {
  flow: 'changeStaffEmail';
  staffId: string;
  newEmail: string;
  accessCode: string;
}

export interface LiveChatMessage {
    id: string;
    text: string;
    timestamp: Timestamp;
    senderId: string; // 'user' or agent's ID
    senderName: string;
}

export interface LiveChatSession {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhotoURL?: string;
    status: 'pending' | 'active' | 'closed';
    createdAt: Timestamp;
    acceptedAt?: Timestamp;
    closedAt?: Timestamp;
    agentId?: string;
    agentName?: string;
    messages?: LiveChatMessage[];
}
