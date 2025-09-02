
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating and sending a One-Time Password (OTP) using Resend.
 *
 * - sendOtp - Generates, stores, and sends an OTP to a user's email.
 * - SendOtpInput - The input type for the sendOtp function.
 * - SendOtpOutput - The return type for the sendOtp function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { addDoc, collection, serverTimestamp, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { z } from 'genkit';
import { Resend } from 'resend';

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
  context: z.enum(['register', 'resetPassword', 'staffRegister', 'staffResetPassword', 'changeEmail']).optional().describe("The context for the OTP request."),
});
export type SendOtpInput = z.infer<typeof SendOtpInputSchema>;

const SendOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendOtpOutput = z.infer<typeof SendOtpOutputSchema>;

export async function sendOtp(input: SendOtpInput): Promise<SendOtpOutput> {
  return sendOtpFlow(input);
}

const sendOtpFlow = ai.defineFlow(
  {
    name: 'sendOtpFlow',
    inputSchema: SendOtpInputSchema,
    outputSchema: SendOtpOutputSchema,
  },
  async ({ email, context = 'register' }) => {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      if (context === 'resetPassword' || context === 'staffResetPassword') {
        const collectionName = context === 'resetPassword' ? 'users' : 'staff';
        const userQuery = query(collection(db, collectionName), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
          return {
            success: false,
            message: 'Email tidak terdaftar.',
          };
        }
      }
      
      const batch = writeBatch(db);

      const q = query(collection(db, 'otps'), where('email', '==', email));
      const oldOtpsSnapshot = await getDocs(q);
      oldOtpsSnapshot.forEach(doc => {
          batch.delete(doc.ref);
      });
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const newOtpRef = doc(collection(db, 'otps'));
      batch.set(newOtpRef, {
        email,
        otp,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });
      
      await batch.commit();

      const emailHtml = `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
                <div>
                    <h2>Kode Verifikasi Anda</h2>
                    <p>Gunakan kode ini untuk melanjutkan: <strong>${otp}</strong></p>
                    <p>Kode ini hanya berlaku selama 10 menit.</p>
                </div>
            </body>
            </html>
          `;

      await resend.emails.send({
        from: 'Baronda <onboarding@resend.dev>',
        to: email,
        subject: 'Kode Verifikasi Anda',
        html: emailHtml,
      });

      return {
        success: true,
        message: 'OTP has been sent to your email.',
      };
    } catch (error) {
      console.error('Failed to send OTP:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
          success: false,
          message: `Gagal mengirim OTP: ${errorMessage}`,
      }
    }
  }
);
