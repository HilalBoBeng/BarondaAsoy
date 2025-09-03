
'use server';
/**
 * @fileOverview A Genkit flow for generating a time-limited QR token for a schedule.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

const GenerateTokenInputSchema = z.object({
  scheduleId: z.string().describe('The ID of the schedule to generate a token for.'),
});
export type GenerateTokenInput = z.infer<typeof GenerateTokenInputSchema>;

const GenerateTokenOutputSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  expires: z.string().optional(), // ISO string
  message: z.string(),
});
export type GenerateTokenOutput = z.infer<typeof GenerateTokenOutputSchema>;

export async function generateScheduleToken(input: GenerateTokenInput): Promise<GenerateTokenOutput> {
  return generateScheduleTokenFlow(input);
}

const generateScheduleTokenFlow = ai.defineFlow(
  {
    name: 'generateScheduleTokenFlow',
    inputSchema: GenerateTokenInputSchema,
    outputSchema: GenerateTokenOutputSchema,
  },
  async ({ scheduleId }) => {
    try {
      const scheduleRef = adminDb.collection('schedules').doc(scheduleId);
      const scheduleDoc = await scheduleRef.get();

      if (!scheduleDoc.exists) {
        return { success: false, message: 'Jadwal tidak ditemukan.' };
      }

      const token = randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      await scheduleRef.update({
        qrToken: token,
        qrTokenExpires: Timestamp.fromDate(expires),
      });

      return { 
        success: true, 
        token: token,
        expires: expires.toISOString(),
        message: 'Token berhasil dibuat.' 
      };
    } catch (error: any) {
      console.error('Error in generateScheduleTokenFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal membuat token: ${errorMessage}` };
    }
  }
);
