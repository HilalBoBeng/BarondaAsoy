
'use server';
/**
 * @fileOverview This file defines a Genkit flow for sending an access code to a new staff member.
 *
 * - sendStaffAccessCode - Generates and sends an access code via email.
 * - SendStaffAccessCodeInput - The input type for the function.
 * - SendStaffAccessCodeOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const SendStaffAccessCodeInputSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  accessCode: z.string(),
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
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: "bobeng.icu@gmail.com",
          pass: "hrll wccf slpw shmt",
        },
      });

      const senderName = "Baronda";

      const mailOptions = {
        from: `"${senderName}" <bobeng.icu@gmail.com>`,
        to: email,
        subject: 'Informasi Akun Petugas Baronda Anda',
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
                        <h2>Selamat Bergabung, ${name}!</h2>
                        <p>Pendaftaran Anda sebagai petugas Baronda telah berhasil disetujui. Gunakan informasi di bawah ini untuk masuk ke akun Anda.</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Kode Akses Anda:</strong></p>
                        <div class="code-box">${accessCode}</div>
                        <div class="warning">
                           <strong>PERINGATAN KEAMANAN:</strong> Jaga kerahasiaan Kode Akses Anda. Jangan pernah membagikan kode ini kepada siapa pun, termasuk admin. Simpan email ini di tempat yang aman.
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
        message: 'Access code has been sent successfully.',
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
    