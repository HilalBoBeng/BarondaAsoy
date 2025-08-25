
import { config } from 'dotenv';
config();

import '@/ai/flows/triage-report.ts';
import '@/ai/flows/send-otp.ts';
import '@/ai/flows/verify-otp.ts';
import '@/ai/flows/send-reply.ts';
import '@/ai/flows/send-staff-access-code.ts';
import '@/ai/flows/reset-staff-password.ts';
import '@/ai/flows/change-email.ts';
