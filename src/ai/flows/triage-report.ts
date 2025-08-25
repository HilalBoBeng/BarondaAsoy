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
  location: z.string().optional().describe('The geolocation of the report, if available.'),
  category: z.string().optional().describe('The category of the report.'),
});
export type TriageReportInput = z.infer<typeof TriageReportInputSchema>;

const TriageReportOutputSchema = z.object({
  threatLevel: z
    .enum(['low', 'medium', 'high'])
    .describe("The assessed threat level of the report: 'low', 'medium', or 'high'."),
  reason: z.string().describe('The reasoning behind the assigned threat level.'),
});
export type TriageReportOutput = z.infer<typeof TriageReportOutputSchema>;

export async function triageReport(input: TriageReportInput): Promise<TriageReportOutput> {
  return triageReportFlow(input);
}

const triageReportPrompt = ai.definePrompt({
  name: 'triageReportPrompt',
  input: {schema: TriageReportInputSchema},
  output: {schema: TriageReportOutputSchema},
  prompt: `You are an AI assistant specialized in triaging reports to assess their threat level.

  Analyze the following report and determine its threat level (low, medium, or high) based on its content, location (if available), and category (if available).

  Provide a brief reason for your assessment.

  Report:
  {{#if category}}Category: {{category}}\n{{/if}}
  Text: {{{reportText}}}
  {{#if location}}Location: {{location}}{{/if}}`,
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
