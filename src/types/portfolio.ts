import { z } from "zod";

export const biomeIDs = ["creative-tech", "ai-systems", "product-apps"] as const;

export const linksSchema = z
  .object({
    demo: z.url().optional(),
    repo: z.url().optional()
  })
  .optional();

export const portfolioItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(20).max(360),
  impact: z.number().min(1).max(10),
  scope: z.number().min(1).max(10),
  tech: z.array(z.string().min(1)).min(1).max(10),
  biomeID: z.enum(biomeIDs),
  role: z.string().min(3).max(120),
  contributions: z.array(z.string().min(8).max(180)).min(1).max(3).optional(),
  challenge: z.string().min(16).max(220).optional(),
  order: z.number().int().min(1).max(99),
  links: linksSchema,
  featured: z.boolean().optional()
});

export const portfolioCollectionSchema = z.array(portfolioItemSchema).min(1);

export type BiomeID = (typeof biomeIDs)[number];
export type PortfolioLinks = z.infer<typeof linksSchema>;
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
