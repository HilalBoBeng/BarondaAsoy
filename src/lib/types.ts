
import { Timestamp } from "firebase/firestore";
import type { TriageReportOutput } from "@/ai/flows/triage-report";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string | Date | Timestamp;
  target?: 'all' | 'users' | 'staff';
}

export interface ScheduleEntry {
  id:string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  time: string;
  officer: string;
  officerId: string;
  area: string;
  status: 'Completed' | 'Pending' | 'In Progress' | 'Izin' | 'Sakit' | 'Pending Review' | 'Tanpa Keterangan';
  reason?: string; // For Izin or Sakit
  qrTokenStart?: string;
  qrTokenStartExpires?: Timestamp;
  qrTokenEnd?: string;
  qrTokenEndExpires?: Timestamp;
  patrolStartTime?: Timestamp;
  patrolEndTime?: Timestamp;
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
  visibility: 'public' | 'private';
  replies?: Reply[] | Record<string, Reply>;
  handlerName?: string;
  handlerId?: string;
  location?: { lat: number; lng: number };
}

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: Timestamp | Date;
  phone?: string;
  addressType?: 'kilongan' | 'luar_kilongan';
  addressDetail?: string;
  isBlocked?: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspensionEndDate?: Timestamp | null;
  lastUpdated_displayName?: Timestamp;
  lastUpdated_phone?: Timestamp;
  lastUpdated_addressDetail?: Timestamp;
  lastUpdated_photoURL?: Timestamp;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  addressType: 'kilongan' | 'luar_kilongan';
  addressDetail: string;
  accessCode: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  suspensionReason?: string;
  suspensionEndDate?: Timestamp | null; // null for permanent
  points?: number;
  lastCodeChangeTimestamp?: Timestamp;
  createdAt?: Timestamp | Date;
  expiresAt?: Timestamp;
  role?: 'petugas' | 'admin' | 'super_admin';
  photoURL?: string | null;
  lastUpdated_name?: Timestamp;
  lastUpdated_phone?: Timestamp;
  lastUpdated_addressDetail?: Timestamp;
  lastUpdated_photoURL?: Timestamp;
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

export interface EquipmentLog {
    id: string;
    equipmentName: string;
    status: 'good' | 'broken' | 'missing';
    notes?: string;
    checkedAt: Timestamp | Date;
    checkedBy: string;
    officerId: string;
}

export interface DuesPayment {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    month: string;
    year: string;
    paymentDate: Date | Timestamp;
    recordedBy: string; // Staff name
    recordedById: string; // Staff ID
}

export interface Honorarium {
    id: string;
    staffId: string;
    staffName: string;
    amount: number;
    period: string; // e.g., "Juli 2024"
    issueDate: Timestamp | Date;
    status: 'Dibayarkan' | 'Belum Dibayar';
    notes?: string;
}

export interface AdminLog {
    id: string;
    adminId: string;
    adminName: string;
    action: string;
    timestamp: Timestamp | Date;
}
