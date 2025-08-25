export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface ScheduleEntry {
  id: string;
  date: string;
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
