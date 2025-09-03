
'use server';
/**
 * @fileOverview This file defines a Genkit flow for sending an access code to a new staff member.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const SendStaffAccessCodeInputSchema = z.object({
  email: z.string().email().describe('The email address of the new staff member.'),
  name: z.string().describe('The name of the new staff member.'),
  accessCode: z.string().describe('The unique access code for the staff member.'),
});
export type SendStaffAccessCodeInput = z.infer<typeof SendStaffAccessCodeInputSchema>;

const SendStaffAccessCodeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendStaffAccessCodeOutput = z.infer<typeof SendStaffAccessCodeOutputSchema>;

export async function sendStaffAccessCode(input: SendStaffAccessCodeInput): Promise<SendStaffAccessCodeOutput> {
  return sendStaffAccessCodeFlow(input);
}

const sendStaffAccessCodeFlow = ai.defineFlow(
  {
    name: 'sendStaffAccessCodeFlow',
    inputSchema: SendStaffAccessCodeInputSchema,
    outputSchema: SendStaffAccessCodeOutputSchema,
  },
  async ({ email, name, accessCode }) => {
    try {
       const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bobeng.icu@gmail.com',
          pass: 'hrll wccf slpw shmt',
        },
      });

      const emailHtml = `
            <!DOCTYPE html>
            <html lang="id">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body>
                <div>
                    <h2>Pendaftaran Anda Disetujui!</h2>
                    <p>Halo ${name},</p>
                    <p>Selamat! Pendaftaran Anda sebagai petugas di aplikasi Baronda telah disetujui oleh admin.</p>
                    <p>Gunakan kode akses unik di bawah ini untuk masuk ke akun Anda:</p>
                    <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${accessCode}</p>
                    <p>Jaga kerahasiaan kode akses ini. Jangan berikan kepada siapa pun.</p>
                </div>
            </body>
            </html>
          `;

      await transporter.sendMail({
        from: '"Baronda" <bobeng.icu@gmail.com>',
        to: email,
        subject: 'Pendaftaran Petugas Baronda Disetujui',
        html: emailHtml,
      });

      return { success: true, message: 'Email persetujuan dan kode akses berhasil dikirim.' };

    } catch (error) {
      console.error('Failed to send access code:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Gagal mengirim kode akses: ${errorMessage}` };
    }
  }
);
