
'use server';
/**
 * @fileOverview A Genkit flow for creating a new admin account.
 * This should only be executable by a Super Admin after OTP verification.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const CreateAdminInputSchema = z.object({
  name: z.string().describe('The name of the new admin.'),
  email: z.string().email().describe('The email of the new admin.'),
  phone: z.string().describe('The phone number of the new admin.'),
  addressType: z.enum(['kilongan', 'luar_kilongan']).describe('The address type.'),
  addressDetail: z.string().optional().describe('The detailed address.'),
});
export type CreateAdminInput = z.infer<typeof CreateAdminInputSchema>;

const CreateAdminOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type CreateAdminOutput = z.infer<typeof CreateAdminOutputSchema>;

export async function createAdmin(input: CreateAdminInput): Promise<CreateAdminOutput> {
  return createAdminFlow(input);
}

const sendAdminWelcomeEmail = async (email: string, name: string, accessCode: string) => {
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
    subject: 'Selamat! Akun Admin Baronda Anda Telah Dibuat',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Akun Admin Dibuat</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Halo ${name}, selamat! Akun Anda sebagai Administrator Baronda telah berhasil dibuat.</p>
          <p style="font-size: 16px;">Berikut adalah kode akses rahasia Anda. Gunakan kode ini untuk masuk ke dasbor admin. Jangan bagikan kode ini kepada siapapun.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${accessCode}</p>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
          <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const createAdminFlow = ai.defineFlow(
  {
    name: 'createAdminFlow',
    inputSchema: CreateAdminInputSchema,
    outputSchema: CreateAdminOutputSchema,
  },
  async ({ name, email, phone, addressType, addressDetail }) => {
    try {
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const newAdminData = {
        name,
        email,
        phone,
        addressType,
        addressDetail: addressType === 'luar_kilongan' ? addressDetail : 'Kilongan',
        status: 'active' as const,
        role: 'admin',
        accessCode: accessCode,
        createdAt: Timestamp.now(),
        points: 0,
      };
      
      const docRef = adminDb.collection('staff').doc();
      await docRef.set(newAdminData);

      await sendAdminWelcomeEmail(email, name, accessCode);

      return { success: true, message: `Admin baru ${name} telah berhasil dibuat.` };
    } catch (error: any) {
      console.error('Error in createAdminFlow:', error);
      return { success: false, message: `Gagal membuat admin: ${error.message}` };
    }
  }
);

    