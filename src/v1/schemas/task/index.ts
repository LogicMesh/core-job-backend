import { z } from 'zod';

// Define the schema for individual output objects
const OutputSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.enum(['TEXT', 'LIST', 'MULTI', 'MEDIA']),
  description: z.string().optional(),
});

// Define the main schema
export const SubmitTaskSchema = z
  .object({
    data: z
      .object({
        metadata: z.string().optional(),
        output: z.array(OutputSchema).optional(),
      })
      .optional(),
  })
  .optional();

// Define the Reject task Schema
export const RejectTaskSchema = z
  .object({
    metadata: z.string().optional(),
    reason: z.string().optional(),
  })
  .optional();
