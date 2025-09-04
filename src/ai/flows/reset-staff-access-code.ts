
'use server';
/**
 * @fileOverview A Genkit flow for resetting a staff member's access code.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';
import type { Staff } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const ResetAccessCodeInputSchema = z.object({
  staffId: z.string().describe('The ID of the staff member.'),
  currentAccessCode: z.string().describe('The current access code for verification.'),
});
export type ResetAccessCodeInput = z.infer<typeof ResetAccessCodeInputSchema>;

const ResetAccessCodeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ResetAccessCodeOutput = z.infer<typeof ResetAccessCodeOutputSchema>;

export async function resetStaffAccessCode(input: ResetAccessCodeInput): Promise<ResetAccessCodeOutput> {
  return resetStaffAccessCodeFlow(input);
}

const sendNewAccessCodeEmail = async (staff: Staff, newAccessCode: string) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'bobeng.icu@gmail.com',
      pass: 'hrll wccf slpw shmt',
    },
  });

  const mailOptions = {
    from: '"Baronda" <bobeng.icu@gmail.com>',
    to: staff.email,
    subject: 'Pembaruan Kode Akses Petugas Baronda Anda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Kode Akses Berhasil Diubah</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Halo ${staff.name}, kode akses Anda telah berhasil diperbarui. Berikut adalah kode akses rahasia Anda yang baru. Jangan bagikan kode ini kepada siapapun.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${newAccessCode}</p>
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
};

const resetStaffAccessCodeFlow = ai.defineFlow(
  {
    name: 'resetStaffAccessCodeFlow',
    inputSchema: ResetAccessCodeInputSchema,
    outputSchema: ResetAccessCodeOutputSchema,
  },
  async ({ staffId, currentAccessCode }) => {
    const staffRef = adminDb.collection('staff').doc(staffId);
    
    try {
      const staffDoc = await staffRef.get();
      if (!staffDoc.exists) {
        return { success: false, message: 'Data staf tidak ditemukan.' };
      }
      const staffData = staffDoc.data() as Staff;

      if (staffData.accessCode !== currentAccessCode) {
        return { success: false, message: 'Kode akses saat ini salah.' };
      }

      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      if (staffData.lastCodeChangeTimestamp && (Date.now() - staffData.lastCodeChangeTimestamp.toMillis()) < sevenDaysInMs) {
        return { success: false, message: 'Anda baru bisa mengubah kode akses lagi setelah 7 hari dari perubahan terakhir.' };
      }

      const newAccessCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      await staffRef.update({
        accessCode: newAccessCode,
        lastCodeChangeTimestamp: Timestamp.now(),
      });
      
      await sendNewAccessCodeEmail(staffData, newAccessCode);

      return { success: true, message: 'Kode akses berhasil diubah dan telah dikirim ke email Anda.' };
    } catch (error: any) {
      console.error('Error in resetStaffAccessCodeFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal mengubah kode akses: ${errorMessage}` };
    }
  }
);
