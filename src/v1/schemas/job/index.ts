import { z } from 'zod';

export const JobCreateSchema = z.object({
  workflow: z.number(),
  validUntil: z.number().optional(),
  language: z.enum(['en', 'ar']).default('en').optional(),
  externalRefNumber: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      mobile: z.string().optional(),
      email: z.string().optional(),
      customerID: z.string().optional(),
    })
    .optional(),
  metadata: z.string().optional(),
  input: z
    .array(
      z.object({
        key: z.string(),
        value: z.any(),
        type: z.any(),
        media: z.any().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

export const MetaDataSchema = z
  .object({
    metadata: z.string().optional(),
  })
  .optional();

export const PrecheksMiddlewareSchema = JobCreateSchema.omit({
  validUntil: true,
  language: true,
  externalRefNumber: true,
  metadata: true,
  input: true,
});

export const FetchWorkflowDataSchema = z.object({
  workflow: z.number(),
});
