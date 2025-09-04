
'use server';
/**
 * @fileOverview A Genkit flow for sending a one-time password (OTP) via email using Nodemailer with Gmail.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import nodemailer from 'nodemailer';
import { TopLevelError } from '@/lib/exceptions/top-level-error';

const SendOtpInputSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
  context: z.enum(['userRegistration', 'staffRegistration', 'staffResetPassword', 'adminCreation']).describe('The context for which the OTP is being sent.'),
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

const emailTemplates = {
  userRegistration: (otp: string) => ({
    subject: 'Kode Verifikasi Akun Baronda Anda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Verifikasi Akun Anda</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Gunakan kode berikut untuk menyelesaikan proses pendaftaran Anda. Kode ini berlaku selama 5 menit.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
          </div>
          <p style="font-size: 14px; color: #666;">Jika Anda tidak merasa meminta kode ini, mohon abaikan email ini.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  }),
  staffResetPassword: (otp: string) => ({
    subject: 'Permintaan Atur Ulang Kode Akses Petugas Baronda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Atur Ulang Kode Akses</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Kami menerima permintaan untuk mengirim ulang kode akses Anda. Gunakan kode OTP di bawah ini untuk verifikasi. Kode ini berlaku 5 menit.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
          </div>
          <p style="font-size: 14px; color: #666;">Jika Anda tidak merasa meminta ini, mohon abaikan email ini.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  }),
  staffRegistration: (otp: string) => ({
    subject: 'Kode Verifikasi Pendaftaran Petugas Baronda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Verifikasi Pendaftaran Petugas</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Gunakan kode berikut untuk memverifikasi pendaftaran Anda sebagai petugas. Kode ini berlaku selama 5 menit.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
          </div>
          <p style="font-size: 14px; color: #666;">Jika Anda tidak merasa mendaftar, mohon abaikan email ini.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  }),
    adminCreation: (otp: string) => ({
    subject: 'Kode Konfirmasi Pembuatan Admin Baronda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #6f42c1; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Konfirmasi Pembuatan Admin</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Anda (Super Admin) mencoba untuk membuat akun admin baru. Gunakan kode berikut untuk mengonfirmasi tindakan ini. Kode berlaku 5 menit.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
          </div>
          <p style="font-size: 14px; color: #666;">Jika Anda tidak merasa melakukan ini, mohon abaikan email ini.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  }),
};


const sendOtpFlow = ai.defineFlow(
  {
    name: 'sendOtpFlow',
    inputSchema: SendOtpInputSchema,
    outputSchema: SendOtpOutputSchema,
  },
  async ({ email, context }) => {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      const otpQuery = query(collection(db, 'otps'), where('email', '==', email), where('context', '==', context));
      const oldOtps = await getDocs(otpQuery);
      const batch = writeBatch(db);
      oldOtps.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      await addDoc(collection(db, 'otps'), {
        email,
        otp,
        context,
        createdAt: serverTimestamp(),
        expiresAt,
      });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bobeng.icu@gmail.com',
          pass: 'hrll wccf slpw shmt',
        },
      });
      
      const template = emailTemplates[context](otp);

      const mailOptions = {
        from: '"Baronda" <bobeng.icu@gmail.com>',
        to: email,
        ...template
      };

      await transporter.sendMail(mailOptions);
      
      return { success: true, message: 'OTP sent successfully.' };

    } catch (error: any) {
      console.error('Error in sendOtpFlow:', error);
      
      if (error.code === 'EAUTH' || (error.responseCode && error.responseCode === 535)) {
          throw new TopLevelError('Unauthorized');
      }

      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Failed to send OTP: ${errorMessage}` };
    }
  }
);

    