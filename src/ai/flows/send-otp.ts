
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating and sending a One-Time Password (OTP).
 *
 * - sendOtp - Generates, stores, and sends an OTP to a user's email.
 * - SendOtpInput - The input type for the sendOtp function.
 * - SendOtpOutput - The return type for the sendOtp function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
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
  async ({ email }) => {
    try {
      // 1. Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // 2. Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // 3. Save to Firestore
      await addDoc(collection(db, 'otps'), {
        email,
        otp,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });

      // 4. Send email using nodemailer
      const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false, // true for 465, false for other ports
          auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
          },
      });

      const mailOptions = {
          from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
          to: email,
          subject: 'Kode Verifikasi Anda untuk Baronda',
          html: `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
                    .container { background-color: #f0f4f8; padding: 30px; }
                    .content { background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 500px; margin: auto; }
                    .header { text-align: center; border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
                    .header img { height: 50px; }
                    .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 5px; text-align: center; color: #2C3E50; background-color: #f0f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .warning { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
                    .footer { font-size: 12px; color: #999; text-align: center; margin-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="content">
                        <div class="header">
                            <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo">
                        </div>
                        <h2>Selamat Datang di Baronda!</h2>
                        <p>Satu langkah lagi untuk mengamankan akun Anda. Silakan gunakan kode verifikasi di bawah ini.</p>
                        <div class="otp-code">${otp}</div>
                        <p>Kode ini hanya berlaku selama <strong>10 menit</strong>.</p>
                        <div class="warning">
                            <strong>PERINGATAN KEAMANAN:</strong> Jangan pernah membagikan kode ini kepada siapa pun. Tim kami tidak akan pernah meminta kode OTP Anda. Jika Anda tidak merasa meminta kode ini, harap abaikan email ini atau hubungi admin jika Anda merasa ada aktivitas mencurigakan.
                        </div>
                    </div>
                    <div class="footer">
                        © ${new Date().getFullYear()} Baronda - Siskamling Digital Kelurahan Kilongan.<br>
                        Email ini dibuat secara otomatis. Mohon tidak membalas email ini.
                    </div>
                </div>
            </body>
            </html>
          `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent OTP to ${email}`);

      return {
        success: true,
        message: 'OTP has been sent to your email.',
      };
    } catch (error) {
      console.error('Failed to send OTP:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to send OTP: ${errorMessage}`,
      };
    }
  }
);
