
'use server';
/**
 * @fileOverview This file defines a Genkit flow for sending a reply from an admin to a user's report
 * and saving the reply to Firestore.
 *
 * - sendReply - Sends an email reply and saves it to the report document.
 * - SendReplyInput - The input type for the sendReply function.
 * - SendReplyOutput - The return type for the sendReply function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, serverTimestamp, collection, getDoc, addDoc } from 'firebase/firestore';
import { headers } from 'next/headers';


const SendReplyInputSchema = z.object({
  reportId: z.string().describe("The ID of the report document in Firestore."),
  recipientEmail: z.string().email().describe("The recipient's email address."),
  replyMessage: z.string().describe('The content of the reply message.'),
  originalReport: z.string().describe('The original report text for context.'),
  replierRole: z.enum(['Admin', 'Petugas']).describe("The role of the person replying."),
  userId: z.string().optional().describe("The ID of the user who made the report."),
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
      let recipientName = 'Warga';
      if(userId) {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              recipientName = userSnap.data().displayName || 'Warga';
          }
      }

      const formattedMessage = `<strong>Yth, ${recipientName.toUpperCase()}</strong>\n\n${replyMessage}\n\nTerima kasih atas partisipasi Anda dalam menjaga keamanan lingkungan.\n\nHormat kami,\n${replierRole}, Tim Baronda`;
      
      const emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Tanggapan dari ${replierRole}</h2>
                <div style="background-color: #f9f9f9; border-left: 4px solid #f9a825; margin: 1em 0; padding: 10px 20px;">
                    <p style="font-style: italic; white-space: pre-wrap;">"${replyMessage}"</p>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666;">Sebagai referensi, berikut adalah laporan awal Anda:</p>
                <blockquote style="border-left: 4px solid #ccc; color: #666; margin: 1em 0; padding: 10px 20px;">
                    <p>"${originalReport}"</p>
                </blockquote>
                <div style="font-size: 12px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    © ${new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.
                    <p style="margin-top: 10px;">Ini adalah email yang dibuat secara otomatis. Mohon untuk tidak membalas email ini.</p>
                </div>
            </div>
          `;

      // 1. Send email notification via API route
      const headersList = headers();
      const host = headersList.get('x-forwarded-host') || headersList.get('host');
      const protocol = headersList.get('x-forwarded-proto') || 'http';
      const baseUrl = host ? `${protocol}://${host}` : 'http://localhost:9002';

      const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: `Tanggapan dari ${replierRole} atas Laporan Anda`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorResult = await emailResponse.json();
        throw new Error(`Email API failed: ${errorResult.details || emailResponse.statusText}`);
      }

      // 2. Save reply to Firestore document
      const reportRef = doc(db, 'reports', reportId);
      const replyId = doc(collection(db, 'reports')).id; // Generate a unique ID for the reply
      const updateData: { [key: string]: any } = {};
      
      updateData[`replies.${replyId}`] = {
          message: replyMessage,
          replierRole: replierRole,
          timestamp: serverTimestamp(),
      };
      
      // Also add the formatted message to the user's notifications collection
      if (userId) {
        await addDoc(collection(db, 'notifications'), {
          userId: userId,
          title: `Tanggapan Laporan: ${originalReport.substring(0, 20)}...`,
          message: formattedMessage,
          read: false,
          createdAt: serverTimestamp(),
          link: '/profile',
        });
      }

      await updateDoc(reportRef, updateData);

      return {
        success: true,
        message: 'Reply has been sent and saved successfully.',
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
