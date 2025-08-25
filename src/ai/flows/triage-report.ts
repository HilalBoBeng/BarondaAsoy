
'use server';

/**
 * @fileOverview This file defines a Genkit flow for triaging incoming reports based on threat level.
 *
 * - triageReport - A function that triages a report and returns a threat level.
 * - TriageReportInput - The input type for the triageReport function.
 * - TriageReportOutput - The return type for the triageReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TriageReportInputSchema = z.object({
  reportText: z.string().describe('The text content of the report.'),
  category: z.string().optional().describe('The category of the report.'),
});
export type TriageReportInput = z.infer<typeof TriageReportInputSchema>;

const TriageReportOutputSchema = z.object({
  threatLevel: z
    .enum(['low', 'medium', 'high'])
    .describe("Tingkat ancaman yang dinilai dari laporan: 'rendah', 'sedang', atau 'tinggi'."),
  reason: z.string().describe('Alasan di balik tingkat ancaman yang diberikan.'),
});
export type TriageReportOutput = z.infer<typeof TriageReportOutputSchema>;

export async function triageReport(input: TriageReportInput): Promise<TriageReportOutput> {
  return triageReportFlow(input);
}

const triageReportPrompt = ai.definePrompt({
  name: 'triageReportPrompt',
  input: {schema: TriageReportInputSchema},
  output: {schema: TriageReportOutputSchema},
  prompt: `Anda adalah asisten AI yang berspesialisasi dalam melakukan triase laporan untuk menilai tingkat ancamannya.

  Analisis laporan berikut dan tentukan tingkat ancamannya (rendah, sedang, atau tinggi) berdasarkan konten dan kategorinya (jika tersedia).

  Berikan alasan singkat untuk penilaian Anda dalam Bahasa Indonesia.

  Laporan:
  {{#if category}}Kategori: {{category}}\n{{/if}}
  Teks: {{{reportText}}}`,
});

const triageReportFlow = ai.defineFlow(
  {
    name: 'triageReportFlow',
    inputSchema: TriageReportInputSchema,
    outputSchema: TriageReportOutputSchema,
  },
  async input => {
    const {output} = await triageReportPrompt(input);
    return output!;
  }
);
