import type { PortfolioItem } from "../types/portfolio";

const biomeLabels: Record<PortfolioItem["biomeID"], string> = {
  "creative-tech": "Creative Tech",
  "ai-systems": "AI Systems",
  "product-apps": "Product Apps"
};

export interface ProjectOverlayController {
  showDefault: () => void;
  showProject: (project: PortfolioItem) => void;
}

const defaultCardMarkup = `
  <p class="eyebrow">Garden Overview</p>
  <h2>Three project biomes</h2>
  <p>
    Start in the central clearing, then explore creative tech on the left, AI systems ahead, and product apps on the right.
  </p>
  <p class="panel-note">The world is intentionally staged first. Project details stay available when you select a piece of work.</p>
`;

export function createProjectOverlay(element: HTMLElement): ProjectOverlayController {
  const showDefault = (): void => {
    element.classList.add("is-compact");
    element.innerHTML = defaultCardMarkup;
  };

  const showProject = (project: PortfolioItem): void => {
    element.classList.remove("is-compact");
    const techMarkup = project.tech
      .map((tech) => `<span class="tech-pill">${tech}</span>`)
      .join("");

    const linksMarkup = project.links
      ? `<div class="project-links">
          ${project.links.demo ? `<a href="${project.links.demo}" target="_blank" rel="noreferrer">Live demo</a>` : ""}
          ${project.links.repo ? `<a href="${project.links.repo}" target="_blank" rel="noreferrer">Repository</a>` : ""}
        </div>`
      : "";

    const contributionsMarkup = project.contributions?.length
      ? `<div class="project-section">
          <span class="project-section-label">Key contributions</span>
          <ul class="project-list">${project.contributions.slice(0, 2).map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>`
      : "";

    element.innerHTML = `
      <p class="eyebrow">${project.featured ? "Featured project" : "Project focus"}</p>
      <h2>${project.title}</h2>
      <p>${project.summary}</p>
      <p class="project-role">${project.role}</p>
      <p class="project-meta">${biomeLabels[project.biomeID]} · ${project.tech.length} core technologies</p>
      <div class="tech-pill-row">${techMarkup}</div>
      ${contributionsMarkup}
      ${linksMarkup}
    `;
  };

  showDefault();

  return {
    showDefault,
    showProject
  };
}
