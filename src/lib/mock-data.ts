import type { Announcement, ScheduleEntry, EmergencyContact } from './types';

export const announcements: Announcement[] = [
  {
    id: '1',
    title: 'Community Clean-Up Day',
    content: 'Join us this Saturday at 9 AM for a community-wide clean-up event. Meet at the central park.',
    date: 'July 20, 2024',
  },
  {
    id: '2',
    title: 'Neighborhood Watch Meeting',
    content: 'Monthly meeting to discuss recent activities and safety measures. All residents are encouraged to attend.',
    date: 'July 25, 2024',
  },
  {
    id: '3',
    title: 'Road Closure on Elm Street',
    content: 'Elm Street will be closed for repairs from 8 AM to 5 PM on Monday. Please plan alternative routes.',
    date: 'July 29, 2024',
  },
];

export const schedule: ScheduleEntry[] = [
  {
    id: 's1',
    date: '2024-07-20',
    time: '8:00 PM - 10:00 PM',
    officer: 'John Doe',
    area: 'North Sector',
    status: 'Completed',
  },
  {
    id: 's2',
    date: '2024-07-20',
    time: '10:00 PM - 12:00 AM',
    officer: 'Jane Smith',
    area: 'South Sector',
    status: 'In Progress',
  },
  {
    id: 's3',
    date: '2024-07-20',
    time: '10:00 PM - 12:00 AM',
    officer: 'Mike Johnson',
    area: 'East Sector',
    status: 'Pending',
  },
   {
    id: 's4',
    date: '2024-07-21',
    time: '12:00 AM - 2:00 AM',
    officer: 'Sarah Brown',
    area: 'West Sector',
    status: 'Pending',
  },
   {
    id: 's5',
    date: '2024-07-21',
    time: '2:00 AM - 4:00 AM',
    officer: 'David Wilson',
    area: 'Central Park',
    status: 'Pending',
  },
];

export const emergencyContacts: EmergencyContact[] = [
    { id: 'ec1', name: 'Local Police', number: '911', type: 'police' },
    { id: 'ec2', name: 'Fire Department', number: '115', type: 'fire' },
    { id: 'ec3', name: 'Main Hospital', number: '118', type: 'medical' },
    { id: 'ec4', name: 'City Hall', number: '555-1234', type: 'other' },
];
