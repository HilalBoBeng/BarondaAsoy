'use server';
/**
 * @fileOverview A Genkit flow for a logged-in staff member to update their own access code.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import type { Staff } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const UpdateAccessCodeInputSchema = z.object({
  staffId: z.string().describe("The ID of the staff member."),
  currentAccessCode: z.string().describe("The current access code for verification."),
  newAccessCode: z.string().min(6, "New access code must be at least 6 characters.").describe("The new access code."),
});
export type UpdateAccessCodeInput = z.infer<typeof UpdateAccessCodeInputSchema>;

const UpdateAccessCodeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type UpdateAccessCodeOutput = z.infer<typeof UpdateAccessCodeOutputSchema>;

export async function updateStaffAccessCode(input: UpdateAccessCodeInput): Promise<UpdateAccessCodeOutput> {
  return updateStaffAccessCodeFlow(input);
}

const updateStaffAccessCodeFlow = ai.defineFlow(
  {
    name: 'updateStaffAccessCodeFlow',
    inputSchema: UpdateAccessCodeInputSchema,
    outputSchema: UpdateAccessCodeOutputSchema,
  },
  async ({ staffId, currentAccessCode, newAccessCode }) => {
    const staffRef = adminDb.collection('staff').doc(staffId);
    
    try {
      const staffDoc = await staffRef.get();
      if (!staffDoc.exists) {
        return { success: false, message: 'Data staf tidak ditemukan.' };
      }
      const staffData = staffDoc.data() as Staff;

      if (staffData.accessCode !== currentAccessCode) {
        return { success: false, message: 'Kode akses saat ini salah.' };
      }

      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      if (staffData.lastCodeChangeTimestamp && (Date.now() - staffData.lastCodeChangeTimestamp.toMillis()) < sevenDaysInMs) {
        return { success: false, message: 'Anda baru bisa mengubah kode akses lagi setelah 7 hari dari perubahan terakhir.' };
      }

      await staffRef.update({
        accessCode: newAccessCode,
        lastCodeChangeTimestamp: Timestamp.now(),
      });
      
      return { success: true, message: 'Kode akses berhasil diubah.' };
    } catch (error: any) {
      console.error('Error in updateStaffAccessCodeFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal mengubah kode akses: ${errorMessage}` };
    }
  }
);
