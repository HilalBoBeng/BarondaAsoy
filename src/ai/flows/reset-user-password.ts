
'use server';
/**
 * @fileOverview A Genkit flow for resetting a user's password.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAuth } from "firebase-admin/auth";

const ResetUserPasswordInputSchema = z.object({
  email: z.string().email().describe("The user's email address."),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").describe("The user's new password."),
});
export type ResetUserPasswordInput = z.infer<typeof ResetUserPasswordInputSchema>;

const ResetUserPasswordOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ResetUserPasswordOutput = z.infer<typeof ResetUserPasswordOutputSchema>;

export async function resetUserPassword(input: ResetUserPasswordInput): Promise<ResetUserPasswordOutput> {
  return resetUserPasswordFlow(input);
}

const resetUserPasswordFlow = ai.defineFlow(
  {
    name: 'resetUserPasswordFlow',
    inputSchema: ResetUserPasswordInputSchema,
    outputSchema: ResetUserPasswordOutputSchema,
  },
  async ({ email, newPassword }) => {
    try {
      const auth = getAuth();
      const user = await auth.getUserByEmail(email);

      if (!user) {
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      await auth.updateUser(user.uid, {
        password: newPassword,
      });

      return { success: true, message: 'Kata sandi berhasil diubah.' };
    } catch (error: any) {
      console.error('Error in resetUserPasswordFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      return { success: false, message: `Gagal mengatur ulang kata sandi: ${errorMessage}` };
    }
  }
);
