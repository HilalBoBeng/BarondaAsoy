
'use server';
/**
 * @fileOverview This file defines a Genkit flow for resetting a staff member's password.
 * This flow generates a new access code, saves it, and sends it via email.
 *
 * - resetStaffPassword - Generates a new access code and sends it to a staff member's email.
 * - ResetStaffPasswordInput - The input type for the function.
 * - ResetStaffPasswordOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
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

      const staffDoc = staffSnapshot.docs[0];
      const staffData = staffDoc.data();
      const { name } = staffData;

      // 2. Generate a new 15-character access code
      const newAccessCode = Math.random().toString(36).substring(2, 17).toUpperCase();

      // 3. Update the access code in Firestore
      await updateDoc(staffDoc.ref, {
        accessCode: newAccessCode
      });

      // 4. Send email with the new access code
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
        subject: 'Reset Kode Akses Petugas Baronda Anda',
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
                    .code-container { display: flex; align-items: center; justify-content: space-between; background-color: #f0f4f8; border-radius: 5px; padding: 10px 15px; margin: 20px 0; border: 1px dashed #ccc; }
                    .code-box { font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2C3E50; font-family: monospace; }
                    .copy-btn { padding: 8px 12px; background-color: #3498DB; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; border: none; cursor: default; }
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
                        <p>Kami menerima permintaan untuk mereset kode akses Anda. Berikut adalah kode akses **baru** Anda untuk masuk ke dasbor petugas:</p>
                        <div class="code-container">
                          <span class="code-box">${newAccessCode}</span>
                          <span class="copy-btn">SALIN</span>
                        </div>
                        <div class="warning">
                           <strong>PERINGATAN KEAMANAN:</strong> Kode akses lama Anda tidak lagi berlaku. Jangan pernah membagikan kode baru ini kepada siapa pun. Jika Anda tidak meminta ini, segera hubungi admin.
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
        message: 'A new access code has been sent to your email.',
      };
    } catch (error) {
      console.error('Failed to reset access code:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to reset access code: ${errorMessage}`,
      };
    }
  }
);
