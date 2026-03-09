import { z } from "zod";

export const biomeIDs = ["meadow", "orchard"] as const;

export const linksSchema = z
  .object({
    demo: z.url().optional(),
    repo: z.url().optional()
  })
  .optional();

export const portfolioItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(20).max(240),
  year: z.number().int().min(2015).max(2035),
  impact: z.number().min(1).max(10),
  scope: z.number().min(1).max(10),
  tech: z.array(z.string().min(1)).min(1).max(10),
  biomeID: z.enum(biomeIDs),
  links: linksSchema,
  featured: z.boolean().optional()
});

export const portfolioCollectionSchema = z.array(portfolioItemSchema).min(1);

export type BiomeID = (typeof biomeIDs)[number];
export type PortfolioLinks = z.infer<typeof linksSchema>;
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
