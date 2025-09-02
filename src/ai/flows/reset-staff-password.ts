
'use server';
/**
 * @fileOverview This file defines a Genkit flow for resetting a staff member's password.
 * This flow finds the existing access code and resends it via email.
 *
 * - resetStaffPassword - Finds and resends a staff member's access code to their email.
 * - ResetStaffPasswordInput - The input type for the function.
 * - ResetStaffPasswordOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { z } from 'genkit';
import { headers } from 'next/headers';

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
      const { name, accessCode } = staffData;

      // 2. Send email with the existing access code
      const emailHtml = `
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
                    .code-box { font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2C3E50; font-family: monospace; text-align: center; background-color: #f0f4f8; border-radius: 5px; padding: 15px; margin: 20px 0; border: 1px dashed #ccc; }
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
                        <p>Kami menerima permintaan untuk mengirim ulang kode akses Anda. Berikut adalah kode akses Anda untuk masuk ke dasbor petugas:</p>
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
          `;

      // Automatically determine the base URL
      const headersList = headers();
      const host = headersList.get('x-forwarded-host') || headersList.get('host');
      const protocol = headersList.get('x-forwarded-proto') || 'http';
      const baseUrl = host ? `${protocol}://${host}` : 'http://localhost:9002';
      
      const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Pengingat Kode Akses Petugas Baronda Anda',
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorResult = await emailResponse.text();
        throw new Error(`Email API failed with status ${emailResponse.status}: ${errorResult}`);
      }
      
      return {
        success: true,
        message: 'Your existing access code has been sent to your email.',
      };
    } catch (error) {
      console.error('Failed to send access code:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to send access code: ${errorMessage}`,
      };
    }
  }
);
