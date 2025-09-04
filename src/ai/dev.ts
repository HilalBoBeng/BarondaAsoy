
'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/triage-report.ts';
import '@/ai/flows/send-otp.ts';
import '@/ai/flows/verify-otp.ts';
import '@/ai/flows/reset-user-password.ts';
import '@/ai/flows/approve-reject-staff.ts';
import '@/ai/flows/generate-schedule-token.ts';
import '@/ai/flows/reset-staff-access-code.ts';
import '@/ai/flows/create-admin.ts';
import '@/ai/flows/send-admin-verification-email.ts';
import '@/ai/flows/verify-admin-token.ts';
