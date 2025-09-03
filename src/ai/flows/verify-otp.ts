
'use server';
/**
 * @fileOverview A Genkit flow for verifying a one-time password (OTP).
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from "@/lib/firebase/admin";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { app } from "@/lib/firebase/client"; // auth needs the client app

const VerifyOtpInputSchema = z.object({
  email: z.string().email().describe('The email address being verified.'),
  otp: z.string().length(6, 'OTP must be 6 digits.').describe('The 6-digit OTP.'),
  name: z.string().optional().describe('The user\'s full name (for registration).'),
  password: z.string().optional().describe('The user\'s password (for registration).'),
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

const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpInputSchema,
    outputSchema: VerifyOtpOutputSchema,
  },
  async ({ email, otp, name, password }) => {
    try {
      const q = adminDb.collection('otps')
        .where('email', '==', email)
        .where('otp', '==', otp)
        .where('context', '==', 'userRegistration');
      
      const otpSnapshot = await q.get();

      if (otpSnapshot.empty) {
        return { success: false, message: 'Kode OTP tidak valid.' };
      }

      const otpDoc = otpSnapshot.docs[0];
      const otpData = otpDoc.data();

      if (otpData.expiresAt.toDate() < new Date()) {
        return { success: false, message: 'Kode OTP sudah kedaluwarsa.' };
      }
      
      // OTP is valid, clean up the OTP document
      const batch = adminDb.batch();
      batch.delete(otpDoc.ref);
      
      if (!name || !password) {
        return { success: false, message: 'Informasi nama atau password tidak lengkap untuk registrasi.' };
      }

      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });
      
      const userDocRef = adminDb.collection('users').doc(user.uid);
      await batch.set(userDocRef, {
        uid: user.uid,
        displayName: name,
        email: user.email,
        createdAt: FieldValue.serverTimestamp(),
        photoURL: null,
        phone: '',
        address: '',
        isBlocked: false,
      });
      
      await batch.commit();

      return { success: true, message: 'Registrasi berhasil!', userId: user.uid };

    } catch (error) {
      console.error('Error in verifyOtpFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
       if ((error as any).code === 'auth/email-already-in-use') {
           return { success: false, message: 'Email ini sudah terdaftar. Silakan gunakan email lain.' };
       }
      return { success: false, message: `Gagal memverifikasi OTP: ${errorMessage}` };
    }
  }
);
