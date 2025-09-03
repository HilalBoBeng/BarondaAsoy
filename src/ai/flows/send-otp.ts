
'use server';
/**
 * @fileOverview A Genkit flow for sending a one-time password (OTP) via email using Resend.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Resend } from 'resend';

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
  context: z.enum(['userRegistration', 'staffResetPassword']).describe('The context for which the OTP is being sent.'),
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
  async ({ email, context }) => {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      // 1. Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      // 2. Clear any previous OTPs for this email and context
      const otpQuery = query(collection(db, 'otps'), where('email', '==', email), where('context', '==', context));
      const oldOtps = await getDocs(otpQuery);
      const batch = writeBatch(db);
      oldOtps.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // 3. Store new OTP in Firestore
      await addDoc(collection(db, 'otps'), {
        email,
        otp,
        context,
        createdAt: serverTimestamp(),
        expiresAt,
      });

      // 4. Send Email via Resend
      const { data, error } = await resend.emails.send({
        from: 'Baronda <onboarding@resend.dev>',
        to: [email],
        subject: 'Kode Verifikasi Anda',
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                <h2>Verifikasi Akun Baronda Anda</h2>
                <p>Gunakan kode berikut untuk menyelesaikan proses pendaftaran Anda. Kode ini berlaku selama 5 menit.</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px; padding: 10px; background-color: #f2f2f2; border-radius: 5px;">${otp}</p>
                <p>Jika Anda tidak merasa meminta kode ini, mohon abaikan email ini.</p>
                <hr style="border: none; border-top: 1px solid #eee;" />
                <p style="font-size: 12px; color: #888;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
            </div>
        `,
      });

      if (error) {
        throw new Error(error.message);
      }
      
      return { success: true, message: 'OTP sent successfully.' };

    } catch (error) {
      console.error('Error in sendOtpFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Failed to send OTP: ${errorMessage}` };
    }
  }
);
