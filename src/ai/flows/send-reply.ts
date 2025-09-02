
'use server';
/**
 * @fileOverview This file defines a Genkit flow for sending a reply to a user's report.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const SendReplyInputSchema = z.object({
  reportId: z.string().describe("The ID of the report being replied to."),
  userId: z.string().describe("The ID of the user who submitted the report."),
  recipientEmail: z.string().email().describe("The email address of the report submitter."),
  replyMessage: z.string().describe("The content of the reply message."),
  originalReport: z.string().describe("The original text of the report."),
  replierRole: z.enum(["Admin", "Petugas"]).describe("The role of the person replying."),
});
export type SendReplyInput = z.infer<typeof SendReplyInputSchema>;

const SendReplyOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendReplyOutput = z.infer<typeof SendReplyOutputSchema>;

export async function sendReply(input: SendReplyInput): Promise<SendReplyOutput> {
  return sendReplyFlow(input);
}

const sendReplyFlow = ai.defineFlow(
  {
    name: 'sendReplyFlow',
    inputSchema: SendReplyInputSchema,
    outputSchema: SendReplyOutputSchema,
  },
  async ({ reportId, recipientEmail, replyMessage, originalReport, replierRole, userId }) => {
    try {
      const reportRef = doc(db, 'reports', reportId);

      const newReply = {
        message: replyMessage,
        replierRole: replierRole,
        timestamp: Timestamp.now(),
      };
      
      const replyKey = `replies.${new Date().getTime()}`;
      await updateDoc(reportRef, {
        [replyKey]: newReply
      });

      const emailHtml = `
            <!DOCTYPE html>
            <html lang="id">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body>
                <div>
                    <h2>Balasan untuk Laporan Anda</h2>
                    <p>Halo,</p>
                    <p>Berikut adalah balasan dari ${replierRole} kami mengenai laporan Anda:</p>
                    <blockquote style="border-left: 4px solid #ccc; padding-left: 1rem; margin: 1rem 0;"><i>"${originalReport}"</i></blockquote>
                    <p><strong>Balasan:</strong></p>
                    <p>${replyMessage}</p>
                    <p>Terima kasih atas partisipasi Anda dalam menjaga keamanan lingkungan.</p>
                </div>
            </body>
            </html>
          `;
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"Baronda" <onboarding@resend.dev>',
        to: recipientEmail,
        subject: 'Re: Laporan Keamanan Anda',
        html: emailHtml,
      });

      return { success: true, message: 'Balasan berhasil dikirim.' };

    } catch (error) {
      console.error('Failed to send reply:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Gagal mengirim balasan: ${errorMessage}` };
    }
  }
);
