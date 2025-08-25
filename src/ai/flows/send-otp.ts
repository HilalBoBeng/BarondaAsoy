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
          subject: 'Kode OTP Verifikasi Anda',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Kode Verifikasi Anda</h2>
                <p>Gunakan kode berikut untuk menyelesaikan proses Anda. Kode ini berlaku selama 10 menit.</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background-color: #f2f2f2; padding: 10px 15px; display: inline-block;">
                    ${otp}
                </p>
                <p>Jika Anda tidak meminta kode ini, harap abaikan email ini.</p>
                <p>Terima kasih,<br/>Tim Baronda Siskamling</p>
            </div>
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
