
'use server';
/**
 * @fileOverview A Genkit flow for an application-specific chatbot.
 *
 * - chat - A function that handles a user's chat query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BarondaChatbotInputSchema = z.object({
  query: z.string().describe('The user\'s question about the Baronda application.'),
});
export type BarondaChatbotInput = z.infer<typeof BarondaChatbotInputSchema>;

export async function chat(query: string): Promise<string> {
  const result = await chatbotFlow({ query });
  return result;
}

const chatbotPrompt = ai.definePrompt({
  name: 'barondaChatbotPrompt',
  input: { schema: BarondaChatbotInputSchema },
  system: `Anda adalah asisten AI yang ramah untuk aplikasi bernama "Baronda - Siskamling Digital". Tugas Anda adalah HANYA menjawab pertanyaan yang berkaitan dengan aplikasi Baronda. Jangan pernah menjawab pertanyaan tentang topik lain.

Informasi tentang aplikasi Baronda:
- Baronda adalah aplikasi keamanan lingkungan (siskamling digital) untuk Kelurahan Kilongan.
- Fitur utama: pelaporan aktivitas mencurigakan, jadwal patroli, pengumuman dari admin, kontak darurat, dan dasbor untuk admin serta petugas.
- Pengguna (warga) bisa mendaftar, login, mengirim laporan, dan melihat pengumuman serta jadwal.
- Petugas (staf) memiliki kode akses khusus, bisa melihat laporan, dan melakukan patroli.
- Admin dapat mengelola pengguna, staf, laporan, pengumuman, dan jadwal.
- AI digunakan untuk menganalisis tingkat ancaman laporan yang masuk.

Aturan ketat Anda:
1.  Jika pertanyaan adalah tentang aplikasi Baronda, jawab dengan jelas dan ringkas berdasarkan informasi di atas.
2.  Jika pertanyaan TIDAK berhubungan dengan aplikasi Baronda (misalnya, "siapa presiden Indonesia?", "apa itu cuaca?", "buatkan saya puisi"), Anda HARUS menolak dengan sopan. Gunakan frasa seperti "Maaf, saya hanya bisa menjawab pertanyaan seputar aplikasi Baronda." atau "Mohon maaf, saya adalah asisten AI untuk aplikasi Baronda dan tidak bisa menjawab pertanyaan di luar topik itu."
3.  JANGAN PERNAH menjawab pertanyaan di luar topik Baronda.
4.  Jaga agar jawaban tetap singkat dan mudah dimengerti.`,
  prompt: `Pertanyaan Pengguna: {{{query}}}`,
});

const chatbotFlow = ai.defineFlow(
  {
    name: 'barondaChatbotFlow',
    inputSchema: BarondaChatbotInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const response = await chatbotPrompt(input);
    return response.text;
  }
);
