
'use server';
/**
 * @fileOverview A Genkit flow for sending a verification link to a new admin.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

const SendAdminVerificationEmailInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  addressType: z.enum(['kilongan', 'luar_kilongan']),
  addressDetail: z.string(),
});
export type SendAdminVerificationEmailInput = z.infer<typeof SendAdminVerificationEmailInputSchema>;

const SendAdminVerificationEmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendAdminVerificationEmailOutput = z.infer<typeof SendAdminVerificationEmailOutputSchema>;

export async function sendAdminVerificationEmail(input: SendAdminVerificationEmailInput): Promise<SendAdminVerificationEmailOutput> {
  return sendAdminVerificationEmailFlow(input);
}

const sendAdminVerificationEmailFlow = ai.defineFlow(
  {
    name: 'sendAdminVerificationEmailFlow',
    inputSchema: SendAdminVerificationEmailInputSchema,
    outputSchema: SendAdminVerificationEmailOutputSchema,
  },
  async (newAdminData) => {
    try {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

      const verificationData = {
        ...newAdminData,
        token,
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      await adminDb.collection('admin_verifications').doc(token).set(verificationData);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bobeng.icu@gmail.com',
          pass: 'hrll wccf slpw shmt',
        },
      });

      const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-admin-registration?token=${token}`;

      const mailOptions = {
        from: '"Baronda" <bobeng.icu@gmail.com>',
        to: newAdminData.email,
        subject: 'Konfirmasi Pendaftaran Admin Baronda',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #6f42c1; color: white; padding: 20px; text-align: center;">
              <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
              <h1 style="margin: 0; font-size: 24px;">Konfirmasi Pendaftaran Admin</h1>
            </div>
            <div style="padding: 30px; text-align: center; color: #333;">
              <p style="font-size: 16px;">Halo ${newAdminData.name},</p>
              <p style="font-size: 16px;">Anda telah didaftarkan sebagai Admin oleh Super Admin Baronda. Klik tombol di bawah ini untuk mengonfirmasi pendaftaran Anda. Tautan ini berlaku selama 1 jam.</p>
              <a href="${verificationLink}" style="display: inline-block; background-color: #6f42c1; color: white; padding: 12px 25px; margin: 20px 0; text-decoration: none; border-radius: 5px; font-weight: bold;">Konfirmasi Pendaftaran</a>
              <p style="font-size: 12px; color: #888;">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
              <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      return { success: true, message: 'Tautan verifikasi berhasil dikirim.' };
    } catch (error: any) {
      console.error('Error in sendAdminVerificationEmailFlow:', error);
      return { success: false, message: `Gagal mengirim email verifikasi: ${error.message}` };
    }
  }
);
