
'use server';
/**
 * @fileOverview A Genkit flow for verifying a one-time password (OTP).
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const VerifyOtpInputSchema = z.object({
  email: z.string().email().describe('The email address being verified.'),
  otp: z.string().length(6, 'OTP must be 6 digits.').describe('The 6-digit OTP.'),
  name: z.string().optional().describe("The user's full name (for registration)."),
  password: z.string().optional().describe("The user's password (for registration)."),
  phone: z.string().optional().describe("The user's phone number (for registration)."),
  addressType: z.enum(['kilongan', 'luar_kilongan']).optional().describe('The type of address.'),
  addressDetail: z.string().optional().describe('The detailed address if outside Kilongan.'),
  flow: z.enum(['userRegistration', 'staffResetPassword', 'userPasswordReset']).describe('The flow context for OTP verification.'),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;

const VerifyOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.string().optional(),
});
export type VerifyOtpOutput = z.infer<typeof VerifyOtpOutputSchema>;

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpOutput> {
  return verifyOtpFlow(input);
}


const sendAccessCodeEmail = async (email: string, name: string, accessCode: string) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'bobeng.icu@gmail.com',
      pass: 'hrll wccf slpw shmt',
    },
  });

  const mailOptions = {
    from: '"Baronda" <bobeng.icu@gmail.com>',
    to: email,
    subject: 'Kode Akses Petugas Baronda Anda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Informasi Kode Akses</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Halo ${name}, berikut adalah kode akses rahasia Anda untuk masuk ke dasbor petugas. Jangan bagikan kode ini kepada siapapun.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${accessCode}</p>
          </div>
          <p style="font-size: 14px; color: #666;">Gunakan kode ini untuk login di halaman login petugas.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}


const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpInputSchema,
    outputSchema: VerifyOtpOutputSchema,
  },
  async ({ email, otp, name, password, phone, addressType, addressDetail, flow }) => {
    try {
      // For userPasswordReset, the OTP context is userRegistration
      const contextToCheck = flow === 'userPasswordReset' ? 'userRegistration' : flow;
      
      const q = adminDb.collection('otps')
        .where('email', '==', email)
        .where('otp', '==', otp)
        .where('context', '==', contextToCheck);
      
      const otpSnapshot = await q.get();

      if (otpSnapshot.empty) {
        return { success: false, message: 'Kode OTP tidak valid.' };
      }

      const otpDoc = otpSnapshot.docs[0];
      const otpData = otpDoc.data();

      if (otpData.expiresAt.toDate() < new Date()) {
        await otpDoc.ref.delete();
        return { success: false, message: 'Kode OTP sudah kedaluwarsa.' };
      }
      
      const batch = adminDb.batch();
      batch.delete(otpDoc.ref); // OTP is valid, clean up the OTP document
      
      if (flow === 'userRegistration') {
        if (!name || !password) {
            return { success: false, message: 'Informasi nama atau password tidak lengkap untuk registrasi.' };
        }

        const auth = getAuth();
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
            // photoURL will be null by default
        });
        
        const userDocRef = adminDb.collection('users').doc(userRecord.uid);
        batch.set(userDocRef, {
            uid: userRecord.uid,
            displayName: name,
            email: email,
            createdAt: FieldValue.serverTimestamp(),
            photoURL: null,
            phone: phone || null,
            addressType: addressType || null,
            addressDetail: addressType === 'luar_kilongan' ? addressDetail : null,
            isBlocked: false,
        });

        // Welcome notification
        const welcomeNotifRef = adminDb.collection('notifications').doc();
        batch.set(welcomeNotifRef, {
             userId: userRecord.uid,
             title: `Selamat Datang di Baronda, ${name}!`,
             message: 'Terima kasih telah bergabung! Akun Anda telah berhasil dibuat. Mari bersama-sama menjaga keamanan lingkungan kita. Jelajahi aplikasi untuk melihat pengumuman terbaru dan melaporkan kejadian.',
             read: false,
             createdAt: FieldValue.serverTimestamp(),
             link: '/profile'
        });
        
        await batch.commit();
        return { success: true, message: 'Registrasi berhasil!', userId: userRecord.uid };
      }
      
      if (flow === 'staffResetPassword') {
          const staffQuery = adminDb.collection('staff').where('email', '==', email).limit(1);
          const staffSnapshot = await staffQuery.get();

          if (staffSnapshot.empty) {
              return { success: false, message: 'Tidak ada akun petugas yang terdaftar dengan email ini.' };
          }
          const staffDoc = staffSnapshot.docs[0];
          const staffData = staffDoc.data();
          
          await sendAccessCodeEmail(email, staffData.name, staffData.accessCode);

          await batch.commit();
          return { success: true, message: 'Verifikasi berhasil. Kode akses Anda telah dikirim ke email.' };
      }
      
      if (flow === 'userPasswordReset') {
         // Just verify the OTP, the password will be reset on the next screen
         await batch.commit();
         return { success: true, message: 'Verifikasi berhasil. Anda akan diarahkan untuk mengatur ulang kata sandi.' };
      }


      await batch.commit(); // commit batch for otp deletion if no other flow matched
      return { success: false, message: 'Alur verifikasi tidak valid.' };

    } catch (error: any) {
      console.error('Error in verifyOtpFlow:', error);
       if (error.code === 'auth/email-already-exists') {
           return { success: false, message: 'Email ini sudah terdaftar. Silakan gunakan email lain.' };
       }
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Gagal memverifikasi OTP: ${errorMessage}` };
    }
  }
);
