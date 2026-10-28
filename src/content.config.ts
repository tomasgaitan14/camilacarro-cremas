import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Guías de «Aprendé con Camila». `status: borrador` muestra un aviso visible hasta que Camila las valide.
const guides = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().min(1).max(90),
    summary: z.string().min(1).max(220),
    order: z.number().int().positive(),
    readingMinutes: z.number().int().positive().max(30),
    // slug del producto cuya foto ilustra la guía (las fotos salen del catálogo, no se inventan)
    coverProduct: z.string().optional(),
    relatedProducts: z.array(z.string()).max(6).default([]),
    status: z.enum(['borrador', 'validada']).default('borrador'),
  }),
});

export const collections = { guides };
