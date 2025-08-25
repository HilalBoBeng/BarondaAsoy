
'use server';
/**
 * @fileOverview This file defines a Genkit flow for handling the change email process.
 * This is a conceptual flow. In a real app, you would have more robust security.
 *
 * - verifyPasswordAndSendChangeEmailOtp - Verifies user's password and sends OTP to the new email.
 * - VerifyPasswordAndSendChangeEmailOtpInput - Input schema.
 * - VerifyPasswordAndSendChangeEmailOtpOutput - Output schema.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase/client';
import { sendOtp } from './send-otp';

const auth = getAuth(app);

const VerifyPasswordAndSendChangeEmailOtpInputSchema = z.object({
  currentEmail: z.string().email(),
  newEmail: z.string().email(),
  password: z.string(),
});
export type VerifyPasswordAndSendChangeEmailOtpInput = z.infer<typeof VerifyPasswordAndSendChangeEmailOtpInputSchema>;

const VerifyPasswordAndSendChangeEmailOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type VerifyPasswordAndSendChangeEmailOtpOutput = z.infer<typeof VerifyPasswordAndSendChangeEmailOtpOutputSchema>;

export async function verifyPasswordAndSendChangeEmailOtp(input: VerifyPasswordAndSendChangeEmailOtpInput): Promise<VerifyPasswordAndSendChangeEmailOtpOutput> {
  return verifyPasswordAndSendChangeEmailOtpFlow(input);
}

const verifyPasswordAndSendChangeEmailOtpFlow = ai.defineFlow(
  {
    name: 'verifyPasswordAndSendChangeEmailOtpFlow',
    inputSchema: VerifyPasswordAndSendChangeEmailOtpInputSchema,
    outputSchema: VerifyPasswordAndSendChangeEmailOtpOutputSchema,
  },
  async ({ currentEmail, newEmail, password }) => {
    try {
      // 1. Verify the user's current password by trying to sign in
      // This is a common pattern to re-authenticate a user for sensitive actions.
      await signInWithEmailAndPassword(auth, currentEmail, password);

      // 2. If re-authentication is successful, send an OTP to the *new* email address.
      const otpResult = await sendOtp({
        email: newEmail,
        context: 'register', // Using 'register' context to imply a verification step
      });

      if (!otpResult.success) {
        throw new Error(otpResult.message);
      }

      return {
        success: true,
        message: 'Password verified. An OTP has been sent to your new email address.',
      };
    } catch (error: any) {
      // Firebase auth errors have a 'code' property
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        return { success: false, message: 'Kata sandi yang Anda masukkan salah.' };
      }
      
      console.error('Failed to verify password and send OTP:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Verification failed: ${errorMessage}`,
      };
    }
  }
);
