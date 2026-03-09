import type { PortfolioItem } from "../types/portfolio";

export interface ProjectOverlayController {
  showDefault: () => void;
  showProject: (project: PortfolioItem) => void;
}

const defaultCardMarkup = `
  <p class="eyebrow">How to use</p>
  <h2>Explore the garden</h2>
  <p>
    Hover a tree to preview it, then click to focus the camera and open recruiter-friendly
    project details.
  </p>
  <ul class="hint-list">
    <li>Impact shapes height.</li>
    <li>Scope thickens the trunk.</li>
    <li>Tech stack adds branches and foliage.</li>
    <li>Year moves projects through the garden timeline.</li>
  </ul>
`;

export function createProjectOverlay(element: HTMLElement): ProjectOverlayController {
  const showDefault = (): void => {
    element.innerHTML = defaultCardMarkup;
  };

  const showProject = (project: PortfolioItem): void => {
    const techMarkup = project.tech
      .map((tech) => `<span class="tech-pill">${tech}</span>`)
      .join("");

    const linksMarkup = project.links
      ? `<div class="project-links">
          ${project.links.demo ? `<a href="${project.links.demo}" target="_blank" rel="noreferrer">Live demo</a>` : ""}
          ${project.links.repo ? `<a href="${project.links.repo}" target="_blank" rel="noreferrer">Repository</a>` : ""}
        </div>`
      : "";

    element.innerHTML = `
      <p class="eyebrow">${project.featured ? "Featured project" : "Project focus"}</p>
      <h2>${project.title}</h2>
      <p>${project.summary}</p>
      <div class="project-metrics">
        <div>
          <span>Year</span>
          <strong>${project.year}</strong>
        </div>
        <div>
          <span>Impact</span>
          <strong>${project.impact}/10</strong>
        </div>
        <div>
          <span>Scope</span>
          <strong>${project.scope}/10</strong>
        </div>
      </div>
      <p class="project-meta">Biome: ${project.biomeID} · Branches: ${project.tech.length}</p>
      <div class="tech-pill-row">${techMarkup}</div>
      ${linksMarkup}
    `;
  };

  showDefault();

  return {
    showDefault,
    showProject
  };
}
