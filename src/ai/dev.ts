
'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/triage-report.ts';
import '@/ai/flows/send-otp.ts';
import '@/ai/flows/verify-otp.ts';
import '@/ai S/flows/reset-user-password.ts';
import '@/ai/flows/approve-reject-staff.ts';
import '@/ai/flows/generate-schedule-token.ts';
