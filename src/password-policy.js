import { z } from 'zod';

export const clientTemporaryPasswordSchema = z.string().min(6).max(128);
