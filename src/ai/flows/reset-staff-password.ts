
'use server';
/**
 * @fileOverview This file defines a Genkit flow for resetting a staff member's password.
 * This flow sends an email with the staff's existing access code.
 *
 * - resetStaffPassword - Resends the access code to a staff member's email.
 * - ResetStaffPasswordInput - The input type for the function.
 * - ResetStaffPasswordOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const ResetStaffPasswordInputSchema = z.object({
  email: z.string().email(),
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
      // 1. Find the staff member by email
      const staffQuery = query(collection(db, 'staff'), where('email', '==', email));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.empty) {
        return { success: false, message: 'Email petugas tidak ditemukan.' };
      }

      const staffData = staffSnapshot.docs[0].data();
      const { name, accessCode } = staffData;

      // 2. Send email with the access code
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
        to: email,
        subject: 'Pengingat Kode Akses Petugas Baronda',
        html: `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                 <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; margin: 0; padding: 0; background-color: #f0f4f8; }
                    .container { background-color: #f0f4f8; padding: 30px; }
                    .content { background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 500px; margin: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
                    .header img { height: 50px; }
                    .code-box { font-size: 28px; font-weight: bold; letter-spacing: 3px; text-align: center; color: #2C3E50; background-color: #f0f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .warning { font-size: 12px; color: #777; text-align: center; margin-top: 20px; padding: 10px; background-color: #fffbe6; border: 1px solid #ffe58f; border-radius: 4px;}
                    .footer { font-size: 12px; color: #999; text-align: center; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="content">
                        <div class="header">
                            <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo">
                        </div>
                        <h2>Lupa Kode Akses, ${name}?</h2>
                        <p>Kami menerima permintaan untuk mengirimkan ulang kode akses Anda. Berikut adalah kode akses Anda untuk masuk ke dasbor petugas:</p>
                        <div class="code-box">${accessCode}</div>
                        <div class="warning">
                           <strong>PERINGATAN KEAMANAN:</strong> Jangan pernah membagikan kode ini kepada siapa pun. Jika Anda tidak meminta ini, segera hubungi admin.
                        </div>
                    </div>
                    <div class="footer">
                        © ${new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.
                        <p style="margin-top: 10px;">Ini adalah email yang dibuat secara otomatis. Mohon untuk tidak membalas email ini.</p>
                    </div>
                </div>
            </body>
            </html>
          `,
      };

      await transporter.sendMail(mailOptions);
      return {
        success: true,
        message: 'Access code reminder has been sent to your email.',
      };
    } catch (error) {
      console.error('Failed to resend access code:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to resend access code: ${errorMessage}`,
      };
    }
  }
);
