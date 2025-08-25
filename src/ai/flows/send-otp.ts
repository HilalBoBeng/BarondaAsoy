
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
import { addDoc, collection, serverTimestamp, query, where, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
  context: z.enum(['register', 'resetPassword']).optional().describe("The context for the OTP request."),
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
  async ({ email, context = 'register' }) => {
    try {
      // If the context is for resetting a password, check if the user exists first.
      if (context === 'resetPassword') {
        const userQuery = query(collection(db, 'users'), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
          return {
            success: false,
            message: 'Email tidak terdaftar.',
          };
        }
      }

      const batch = writeBatch(db);

      // 1. Invalidate all previous active OTPs for this email
      const q = query(collection(db, 'otps'), where('email', '==', email));
      const oldOtpsSnapshot = await getDocs(q);
      
      oldOtpsSnapshot.forEach(doc => {
          const data = doc.data();
          const isExpired = data.expiresAt ? (data.expiresAt as Timestamp).toDate() < new Date() : true;
          // Invalidate if it's not used and not expired
          if (!data.used && !isExpired) {
              batch.update(doc.ref, { used: true });
          }
      });
      
      // 2. Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // 3. Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // 4. Save new OTP to Firestore
      const newOtpRef = doc(collection(db, 'otps'));
      batch.set(newOtpRef, {
        email,
        otp,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });

      // 5. Send email using nodemailer
      const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false, // true for 465, false for other ports
          auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
          },
      });

      const isResetPassword = context === 'resetPassword';
      const subject = isResetPassword 
        ? 'Atur Ulang Kata Sandi Akun Baronda Anda' 
        : 'Kode Verifikasi Akun Baronda Anda';

      const welcomeMessage = isResetPassword
        ? `<p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Gunakan kode di bawah ini untuk melanjutkan.</p>`
        : `<h2>Selamat Datang di Baronda!</h2>
           <p>Terima kasih telah mendaftar. Satu langkah lagi untuk mengamankan akun Anda. Silakan gunakan kode verifikasi di bawah ini.</p>`;

      const securityWarning = isResetPassword
        ? `<strong>PERINGATAN KEAMANAN:</strong> Jika Anda tidak merasa meminta untuk mengatur ulang kata sandi, harap abaikan email ini dan segera amankan akun Anda.`
        : `<strong>PERINGATAN KEAMANAN:</strong> Jangan pernah membagikan kode ini kepada siapa pun. Jika Anda tidak merasa mendaftar, harap abaikan email ini.`;


      const mailOptions = {
          from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
          to: email,
          subject: subject,
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
                    .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 5px; text-align: center; color: #2C3E50; background-color: #f0f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
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
                        ${welcomeMessage}
                        <div class="otp-code">${otp}</div>
                        <p>Kode ini hanya berlaku selama <strong>10 menit</strong>.</p>
                        <div class="warning">
                           ${securityWarning}
                        </div>
                    </div>
                    <div class="footer">
                        © ${new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.
                    </div>
                </div>
            </body>
            </html>
          `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent OTP to ${email}`);

      // 6. Commit all database changes
      await batch.commit();

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
