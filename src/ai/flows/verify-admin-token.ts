
'use server';
/**
 * @fileOverview A Genkit flow for verifying a new admin's registration token.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createAdmin } from '@/ai/flows/create-admin';

const VerifyAdminTokenInputSchema = z.object({
  token: z.string().describe('The verification token from the email link.'),
});
export type VerifyAdminTokenInput = z.infer<typeof VerifyAdminTokenInputSchema>;

const VerifyAdminTokenOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type VerifyAdminTokenOutput = z.infer<typeof VerifyAdminTokenOutputSchema>;

export async function verifyAdminToken(input: VerifyAdminTokenInput): Promise<VerifyAdminTokenOutput> {
  return verifyAdminTokenFlow(input);
}

const verifyAdminTokenFlow = ai.defineFlow(
  {
    name: 'verifyAdminTokenFlow',
    inputSchema: VerifyAdminTokenInputSchema,
    outputSchema: VerifyAdminTokenOutputSchema,
  },
  async ({ token }) => {
    try {
      const q = adminDb.collection('admin_verifications').where('token', '==', token).limit(1);
      const verificationSnapshot = await q.get();

      if (verificationSnapshot.empty) {
        return { success: false, message: 'Token tidak valid atau tidak ditemukan.' };
      }
      
      const verificationDoc = verificationSnapshot.docs[0];
      const verificationRef = verificationDoc.ref;
      const data = verificationDoc.data();

      if (!data || data.expiresAt.toDate() < new Date()) {
        await verificationRef.delete();
        return { success: false, message: 'Token sudah kedaluwarsa. Mohon minta Super Admin untuk mendaftar ulang.' };
      }

      // Token is valid, proceed to create the admin
      const createResult = await createAdmin({
          name: data.name,
          email: data.email,
          phone: data.phone,
          addressType: data.addressType,
          addressDetail: data.addressDetail,
          role: data.role,
      });
      
      if (!createResult.success) {
        throw new Error(createResult.message);
      }
      
      // Delete the verification token after successful use
      await verificationRef.delete();

      return { success: true, message: createResult.message };
    } catch (error: any) {
      console.error('Error in verifyAdminTokenFlow:', error);
      return { success: false, message: `Gagal memverifikasi token: ${error.message}` };
    }
  }
);
