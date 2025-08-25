import { config } from 'dotenv';
config();

import '@/ai/flows/triage-report.ts';
import '@/ai/flows/send-otp.ts';
import '@/ai/flows/verify-otp.ts';
import '@/ai/flows/send-reply.ts';
