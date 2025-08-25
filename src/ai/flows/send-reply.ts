'use server';
/**
 * @fileOverview This file defines a Genkit flow for sending a reply from an admin to a user's report.
 *
 * - sendReply - Sends an email reply to the user who submitted a report.
 * - SendReplyInput - The input type for the sendReply function.
 * - SendReplyOutput - The return type for the sendReply function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const SendReplyInputSchema = z.object({
  recipientEmail: z.string().email().describe("The recipient's email address."),
  replyMessage: z.string().describe('The content of the reply message.'),
  originalReport: z.string().describe('The original report text for context.'),
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
  async ({ recipientEmail, replyMessage, originalReport }) => {
    try {
      const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false, 
          auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
          },
      });

      const mailOptions = {
          from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
          to: recipientEmail,
          subject: 'Tanggapan atas Laporan Anda',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Tanggapan dari Admin</h2>
                <p>Berikut adalah tanggapan dari admin terkait laporan yang Anda kirimkan:</p>
                <div style="background-color: #f9f9f9; border-left: 4px solid #f9a825; margin: 1em 0; padding: 10px 20px;">
                    <p style="font-style: italic;">"${replyMessage}"</p>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666;">Sebagai referensi, berikut adalah laporan awal Anda:</p>
                <blockquote style="border-left: 4px solid #ccc; color: #666; margin: 1em 0; padding: 10px 20px;">
                    <p>"${originalReport}"</p>
                </blockquote>
                <p>Terima kasih atas partisipasi Anda dalam menjaga keamanan lingkungan.</p>
                <p>Hormat kami,<br/>Tim Baronda Siskamling</p>
            </div>
          `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent reply to ${recipientEmail}`);

      return {
        success: true,
        message: 'Reply has been sent successfully.',
      };
    } catch (error) {
      console.error('Failed to send reply:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        success: false,
        message: `Failed to send reply: ${errorMessage}`,
      };
    }
  }
);
