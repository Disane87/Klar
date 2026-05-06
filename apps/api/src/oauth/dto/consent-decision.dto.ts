import { z } from 'zod';
import { authorizeQuerySchema } from './authorize-query.dto';

/**
 * POST /api/v1/oauth/consent Body — User entscheidet auf der Consent-Page.
 * Wir verlangen NOCHMAL alle ursprünglichen Authorize-Params, weil der
 * Backend-Endpoint stateless arbeitet (kein Session-State zwischen GET und POST).
 */
export const consentDecisionSchema = authorizeQuerySchema.extend({
  approve: z.boolean(),
});

export type ConsentDecision = z.output<typeof consentDecisionSchema>;
