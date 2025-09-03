
import { config } from 'dotenv';
config();

// import '@/ai/flows/send-otp.ts'; // Dihapus
import '@/ai/flows/triage-report.ts';
// import '@/ai/flows/verify-otp.ts'; // Dihapus
import '@/ai/flows/send-reply.ts';
// import '@/ai/flows/reset-staff-password.ts'; // Dihapus
import '@/ai/flows/send-staff-access-code.ts';
