
'use server';
/**
 * @fileOverview This file defines a Genkit flow for handling the staff email change process.
 *
 * - changeStaffEmail - Verifies staff's access code and sends OTP to the new email.
 * - ChangeStaffEmailInput - Input schema.
 * - ChangeStaffEmailOutput - Output schema.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { sendOtp } from './send-otp';

const ChangeStaffEmailInputSchema = z.object({
  staffId: z.string(),
  newEmail: z.string().email(),
  accessCode: z.string(),
});
export type ChangeStaffEmailInput = z.infer<typeof ChangeStaffEmailInputSchema>;

const ChangeStaffEmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ChangeStaffEmailOutput = z.infer<typeof ChangeStaffEmailOutputSchema>;

export async function changeStaffEmail(input: ChangeStaffEmailInput): Promise<ChangeStaffEmailOutput> {
  return changeStaffEmailFlow(input);
}

const changeStaffEmailFlow = ai.defineFlow(
  {
    name: 'changeStaffEmailFlow',
    inputSchema: ChangeStaffEmailInputSchema,
    outputSchema: ChangeStaffEmailOutputSchema,
  },
  async ({ staffId, newEmail, accessCode }) => {
    try {
      // 1. Verify the staff's current access code
      const staffRef = doc(db, 'staff', staffId);
      const staffDoc = await getDoc(staffRef);

      if (!staffDoc.exists() || staffDoc.data().accessCode !== accessCode) {
        return { success: false, message: 'Kode akses yang Anda masukkan salah.' };
      }

      // 2. If verification is successful, send an OTP to the *new* email address.
      const otpResult = await sendOtp({
        email: newEmail,
        context: 'changeEmail', // Re-use the same email template
      });

      if (!otpResult.success) {
        throw new Error(otpResult.message);
      }

      return {
        success: true,
        message: 'Kode akses terverifikasi. OTP telah dikirim ke email baru Anda.',
      };
    } catch (error: any) {
      console.error('Failed to verify access code and send OTP:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Verification failed: ${errorMessage}`,
      };
    }
  }
);
