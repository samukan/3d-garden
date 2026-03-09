import type { PortfolioItem } from "../types/portfolio";
import { portfolioCollectionSchema } from "../types/portfolio";

export function validatePortfolioData(source: unknown): PortfolioItem[] {
  const parsed = portfolioCollectionSchema.safeParse(source);

  if (parsed.success) {
    return parsed.data;
  }

  throw new Error(
    `Portfolio data failed validation: ${parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ")}`
  );
}
