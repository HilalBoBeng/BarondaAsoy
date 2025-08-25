'use server';
/**
 * @fileOverview This file defines a Genkit flow for verifying a One-Time Password (OTP).
 *
 * - verifyOtp - Verifies the provided OTP against the one stored in Firestore.
 * - VerifyOtpInput - The input type for the verifyOtp function.
 * - VerifyOtpOutput - The return type for the verifyOtp function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { z } from 'genkit';

const VerifyOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to verify.'),
  otp: z.string().length(6).describe('The 6-digit OTP.'),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;

const VerifyOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type VerifyOtpOutput = z.infer<typeof VerifyOtpOutputSchema>;

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpOutput> {
  return verifyOtpFlow(input);
}

const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpInputSchema,
    outputSchema: VerifyOtpOutputSchema,
  },
  async ({ email, otp }) => {
    try {
      const q = query(
        collection(db, 'otps'),
        where('email', '==', email),
        where('otp', '==', otp)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'Kode OTP tidak valid.' };
      }

      const otpDoc = querySnapshot.docs[0];
      const otpData = otpDoc.data();

      // Check if used
      if (otpData.used) {
        return { success: false, message: 'Kode OTP ini sudah digunakan.' };
      }

      // Check for expiration
      const expiresAt = (otpData.expiresAt as Timestamp).toDate();
      if (expiresAt < new Date()) {
        return { success: false, message: 'Kode OTP telah kedaluwarsa.' };
      }
      
      // Mark OTP as used
      const batch = writeBatch(db);
      batch.update(otpDoc.ref, { used: true });
      await batch.commit();

      return {
        success: true,
        message: 'Verifikasi OTP berhasil.',
      };
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Gagal memverifikasi OTP: ${errorMessage}`,
      };
    }
  }
);
