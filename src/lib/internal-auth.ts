/**
 * Internal API auth — for machine-to-machine calls (e.g. HR pulling KPI).
 *
 * Header: x-internal-key
 * Env:    INTERNAL_API_KEY (must be set in Vercel — do NOT commit)
 *
 * Spec: INTEGRATION-graphic.md § Task 3
 */

import type { NextRequest } from 'next/server';

export function isInternalCall(req: NextRequest | Request): boolean {
  const headers = (req as NextRequest).headers ?? (req as Request).headers;
  const key = headers.get('x-internal-key');
  const expected = process.env.INTERNAL_API_KEY;

  // Fail closed if env not configured (don't accept any key)
  if (!expected || expected.length < 16) return false;
  if (!key) return false;

  // Constant-time-ish compare (Node's timingSafeEqual not available in edge runtime
  // without buffer setup; this is acceptable since key is short and request is rate-limited
  // at the platform level)
  if (key.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < key.length; i++) {
    mismatch |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
