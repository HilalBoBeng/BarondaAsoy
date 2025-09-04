
'use server';
/**
 * @fileOverview A Genkit flow for approving or rejecting staff registrations.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';
import type { Staff } from '@/lib/types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const StaffApprovalInputSchema = z.object({
  staffId: z.string().describe('The ID of the staff member to approve/reject.'),
  approved: z.boolean().describe('Whether to approve or reject the registration.'),
  rejectionReason: z.string().optional().describe('The reason for rejection.'),
});
export type StaffApprovalInput = z.infer<typeof StaffApprovalInputSchema>;

const StaffApprovalOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type StaffApprovalOutput = z.infer<typeof StaffApprovalOutputSchema>;

export async function approveOrRejectStaff(input: StaffApprovalInput): Promise<StaffApprovalOutput> {
  return approveOrRejectStaffFlow(input);
}


const sendApprovalEmail = async (staff: Staff) => {
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
    subject: 'Selamat! Pendaftaran Petugas Baronda Anda Disetujui',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
          <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Pendaftaran Disetujui</h1>
        </div>
        <div style="padding: 30px; text-align: center; color: #333;">
          <p style="font-size: 16px;">Halo ${staff.name}, selamat! Pendaftaran Anda sebagai petugas Baronda telah disetujui oleh Admin.</p>
          <p style="font-size: 16px;">Berikut adalah kode akses rahasia Anda. Gunakan kode ini untuk masuk ke dasbor petugas. Jangan bagikan kode ini kepada siapapun.</p>
          <div style="background-color: #f2f2f2; border-radius: 5px; margin: 20px 0; padding: 15px;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${staff.accessCode}</p>
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

const sendRejectionEmail = async (staff: Staff, reason: string) => {
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
        subject: 'Pembaruan Mengenai Pendaftaran Petugas Baronda Anda',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
                    <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
                    <h1 style="margin: 0; font-size: 24px;">Pendaftaran Ditolak</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    <p style="font-size: 16px;">Halo ${staff.name},</p>
                    <p style="font-size: 16px;">Terima kasih atas minat Anda untuk bergabung dengan tim petugas Baronda. Setelah peninjauan, dengan berat hati kami informasikan bahwa pendaftaran Anda belum dapat kami setujui saat ini.</p>
                    <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; color: #721c24; margin: 20px 0; padding: 15px;">
                        <p style="font-weight: bold; margin-top: 0;">Alasan Penolakan:</p>
                        <p style="margin-bottom: 0;">${reason}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">Kami menghargai waktu dan usaha yang telah Anda luangkan. Terima kasih.</p>
                </div>
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
                </div>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};


const approveOrRejectStaffFlow = ai.defineFlow(
  {
    name: 'approveOrRejectStaffFlow',
    inputSchema: StaffApprovalInputSchema,
    outputSchema: StaffApprovalOutputSchema,
  },
  async ({ staffId, approved, rejectionReason }) => {
    const staffRef = adminDb.collection('staff').doc(staffId);
    
    try {
      const staffDoc = await staffRef.get();
      if (!staffDoc.exists) {
        return { success: false, message: 'Data staf tidak ditemukan atau mungkin telah kedaluwarsa.' };
      }
      const staffData = staffDoc.data() as Staff;

      if (approved) {
        await staffRef.update({ 
            status: 'active', 
            points: 0,
            expiresAt: FieldValue.delete() // Remove expiration on approval
        });
        await sendApprovalEmail(staffData);
        return { success: true, message: `${staffData.name} telah disetujui.` };
      } else {
        if (!rejectionReason) {
             return { success: false, message: 'Alasan penolakan harus diisi.' };
        }
        await staffRef.delete();
        await sendRejectionEmail(staffData, rejectionReason);
        return { success: true, message: `Pendaftaran ${staffData.name} telah ditolak.` };
      }
    } catch (error: any) {
      console.error('Error in approveOrRejectStaffFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal memproses pendaftaran: ${errorMessage}` };
    }
  }
);
