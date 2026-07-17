import { z } from "zod/v4";

// Structured output shape for the Digital Diagnosis Agent's website analysis.
// Reused by: the /public/digital-diagnosis endpoint (stored in diagnoses.result)
// and the PDF generator (stage 3).
export const digitalDiagnosisAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  metaInfo: z.object({
    title: z.string().nullable(),
    titleLength: z.number(),
    metaDescription: z.string().nullable(),
    metaDescriptionLength: z.number(),
    hasViewportMeta: z.boolean(),
    language: z.string().nullable(),
    issues: z.array(z.string()),
  }),
  contentQuality: z.object({
    wordCount: z.number(),
    hasH1: z.boolean(),
    headingStructureOk: z.boolean(),
    readabilityNotes: z.string(),
    issues: z.array(z.string()),
  }),
  structure: z.object({
    mobileFriendlySignals: z.boolean(),
    hasSsl: z.boolean(),
    issues: z.array(z.string()),
  }),
  links: z.object({
    internalLinksCount: z.number(),
    externalLinksCount: z.number(),
    issues: z.array(z.string()),
  }),
  generalFactors: z.object({
    hasContactInfo: z.boolean(),
    hasSocialLinks: z.boolean(),
    hasCallToAction: z.boolean(),
    issues: z.array(z.string()),
  }),
  prioritizedTasks: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(1),
  summary: z.string(),
});

export type DigitalDiagnosisAnalysis = z.infer<typeof digitalDiagnosisAnalysisSchema>;
