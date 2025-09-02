
'use server';
/**
 * @fileOverview This file defines a Genkit flow for resetting a staff member's password
 * by sending them their access code.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const ResetStaffPasswordInputSchema = z.object({
  email: z.string().email().describe('The email address of the staff member.'),
});
export type ResetStaffPasswordInput = z.infer<typeof ResetStaffPasswordInputSchema>;

const ResetStaffPasswordOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ResetStaffPasswordOutput = z.infer<typeof ResetStaffPasswordOutputSchema>;

export async function resetStaffPassword(input: ResetStaffPasswordInput): Promise<ResetStaffPasswordOutput> {
  return resetStaffPasswordFlow(input);
}

const resetStaffPasswordFlow = ai.defineFlow(
  {
    name: 'resetStaffPasswordFlow',
    inputSchema: ResetStaffPasswordInputSchema,
    outputSchema: ResetStaffPasswordOutputSchema,
  },
  async ({ email }) => {
    try {
      const staffQuery = query(collection(db, "staff"), where("email", "==", email), where("status", "==", "active"));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        return { success: false, message: 'Akun staf aktif dengan email ini tidak ditemukan.' };
      }

      const staffData = staffSnapshot.docs[0].data();
      const staffName = staffData.name;
      const accessCode = staffData.accessCode;

      const emailHtml = `
            <!DOCTYPE html>
            <html lang="id">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body>
                <div>
                    <h2>Kode Akses Anda</h2>
                    <p>Halo ${staffName},</p>
                    <p>Anda telah meminta untuk mereset kata sandi Anda. Berikut adalah kode akses Anda yang dapat digunakan untuk masuk:</p>
                    <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${accessCode}</p>
                    <p>Jaga kerahasiaan kode akses ini.</p>
                </div>
            </body>
            </html>
          `;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"Baronda" <onboarding@resend.dev>',
        to: email,
        subject: 'Reset Kata Sandi Petugas - Kode Akses Anda',
        html: emailHtml,
      });

      return { success: true, message: 'Kode akses telah dikirim ulang ke email Anda.' };

    } catch (error) {
      console.error('Failed to reset staff password:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Gagal mereset kata sandi: ${errorMessage}` };
    }
  }
);
