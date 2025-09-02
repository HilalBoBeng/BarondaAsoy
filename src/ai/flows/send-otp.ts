
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

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
  context: z.enum(['register', 'resetPassword', 'staffRegister', 'staffResetPassword', 'changeEmail']).optional().describe("The context for the OTP request."),
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
      // Check if user/staff exists if it's a password reset context
      if (context === 'resetPassword' || context === 'staffResetPassword') {
        const collectionName = context === 'resetPassword' ? 'users' : 'staff';
        const userQuery = query(collection(db, collectionName), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
          return {
            success: false,
            message: 'Email tidak terdaftar.',
          };
        }
      }

      const batch = writeBatch(db);

      // 1. Delete all previous active OTPs for this email to prevent reuse
      const q = query(collection(db, 'otps'), where('email', '==', email));
      const oldOtpsSnapshot = await getDocs(q);
      
      oldOtpsSnapshot.forEach(doc => {
          batch.delete(doc.ref);
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

      // 5. Prepare email content
      const senderName = "Baronda";
      let subject = '';
      let welcomeMessage = '';
      let securityWarning = '';

      switch (context) {
        case 'staffRegister':
            subject = 'Kode Verifikasi Pendaftaran Petugas Baronda';
            welcomeMessage = `<h2>Pendaftaran Petugas Baronda</h2><p>Gunakan kode di bawah ini untuk menyelesaikan pendaftaran Anda sebagai petugas.</p>`;
            securityWarning = `<strong>PERINGATAN KEAMANAN:</strong> Jika Anda tidak merasa mendaftar sebagai petugas, harap abaikan email ini.`;
            break;
        case 'staffResetPassword':
            subject = 'Atur Ulang Akses Petugas Baronda';
            welcomeMessage = `<p>Kami menerima permintaan untuk mengatur ulang akses akun petugas Anda. Gunakan kode di bawah ini untuk melanjutkan.</p>`;
            securityWarning = `<strong>PERINGATAN KEAMANAN:</strong> Jika Anda tidak merasa meminta ini, harap abaikan email ini dan hubungi admin.`;
            break;
        case 'resetPassword':
            subject = 'Atur Ulang Kata Sandi Akun Baronda Anda';
            welcomeMessage = `<p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Gunakan kode di bawah ini untuk melanjutkan.</p>`;
            securityWarning = `<strong>PERINGATAN KEAMANAN:</strong> Jika Anda tidak merasa meminta untuk mengatur ulang kata sandi, harap abaikan email ini dan segera amankan akun Anda.`;
            break;
        case 'changeEmail':
            subject = 'Verifikasi Perubahan Email Akun Baronda Anda';
            welcomeMessage = `<p>Gunakan kode di bawah ini untuk mengonfirmasi perubahan alamat email Anda.</p>`;
            securityWarning = `<strong>PERINGATAN KEAMANAN:</strong> Jika Anda tidak meminta perubahan ini, segera amankan akun Anda dan hubungi admin.`;
            break;
        default: // 'register'
            subject = 'Kode Verifikasi Akun Baronda Anda';
            welcomeMessage = `<h2>Selamat Datang di Baronda!</h2><p>Terima kasih telah mendaftar. Satu langkah lagi untuk mengamankan akun Anda. Silakan gunakan kode verifikasi di bawah ini.</p>`;
            securityWarning = `<strong>PERINGATAN KEAMANAN:</strong> Jangan pernah membagikan kode ini kepada siapa pun. Jika Anda tidak merasa mendaftar, harap abaikan email ini.`;
            break;
      }

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
                         <p style="margin-top: 10px;">Ini adalah email yang dibuat secara otomatis. Mohon untuk tidak membalas email ini.</p>
                    </div>
                </div>
            </body>
            </html>
          `;

      // 6. Call the new API route to send the email
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
      const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `"${senderName}" <bobeng.icu@gmail.com>`,
          to: email,
          subject: subject,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorResult = await emailResponse.json();
        throw new Error(`Email API failed: ${errorResult.details || emailResponse.statusText}`);
      }

      // 7. Commit all database changes
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
        message: `Gagal mengirim OTP: ${errorMessage}`,
      };
    }
  }
);
