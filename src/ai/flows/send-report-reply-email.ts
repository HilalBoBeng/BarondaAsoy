
'use server';
/**
 * @fileOverview A Genkit flow for sending an email notification to a user when a staff member replies to their report.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const SendReportReplyEmailInputSchema = z.object({
  recipientEmail: z.string().email().describe('The email address of the user who made the report.'),
  reportText: z.string().describe('The original text of the report.'),
  replyMessage: z.string().describe('The message from the staff member.'),
  officerName: z.string().describe('The name of the staff member who replied.'),
});
export type SendReportReplyEmailInput = z.infer<typeof SendReportReplyEmailInputSchema>;

const SendReportReplyEmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendReportReplyEmailOutput = z.infer<typeof SendReportReplyEmailOutputSchema>;

export async function sendReportReplyEmail(input: SendReportReplyEmailInput): Promise<SendReportReplyEmailOutput> {
  return sendReportReplyEmailFlow(input);
}

const sendReportReplyEmailFlow = ai.defineFlow(
  {
    name: 'sendReportReplyEmailFlow',
    inputSchema: SendReportReplyEmailInputSchema,
    outputSchema: SendReportReplyEmailOutputSchema,
  },
  async ({ recipientEmail, reportText, replyMessage, officerName }) => {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bobeng.icu@gmail.com',
          pass: 'hrll wccf slpw shmt',
        },
      });

      const mailOptions = {
        from: '"Baronda" <bobeng.icu@gmail.com>',
        to: recipientEmail,
        subject: 'Balasan untuk Laporan Anda di Baronda',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #FF7426; color: white; padding: 20px; text-align: center;">
              <img src="https://iili.io/KJ4aGxp.png" alt="Baronda Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
              <h1 style="margin: 0; font-size: 24px;">Laporan Anda Telah Ditanggapi</h1>
            </div>
            <div style="padding: 30px; color: #333;">
              <p style="font-size: 16px;">Laporan Anda telah ditanggapi oleh petugas kami. Terima kasih atas partisipasi Anda dalam menjaga keamanan lingkungan.</p>
              
              <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; margin: 20px 0; padding: 15px;">
                <p style="font-size: 14px; color: #6c757d; margin-top: 0;"><strong>Laporan Anda:</strong></p>
                <p style="font-size: 14px; font-style: italic;">"${reportText}"</p>
              </div>

              <div style="background-color: #e9f7ef; border: 1px solid #d1e7dd; border-radius: 5px; margin: 20px 0; padding: 15px;">
                <p style="font-size: 14px; color: #0f5132; margin-top: 0;"><strong>Balasan dari Petugas (${officerName}):</strong></p>
                <p style="font-size: 14px;">${replyMessage}</p>
              </div>

              <p style="font-size: 14px; color: #666;">Anda dapat melihat riwayat lengkap laporan Anda dengan masuk ke aplikasi Baronda.</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888;">
              <p style="margin: 0;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      
      return { success: true, message: 'Email balasan berhasil dikirim.' };

    } catch (error: any) {
      console.error('Error in sendReportReplyEmailFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal mengirim email balasan: ${errorMessage}` };
    }
  }
);
