import { readFile, writeFile } from "node:fs/promises";

const INDEX_PATH = new URL("../index.html", import.meta.url);
const TOPIC = "chicago-open-bioinformatics";
const API_URL = "https://api.github.com/search/repositories";
const MAX_PAGES = 10;
const GENERATED_START = "<!-- generated-project-cards:start -->";
const GENERATED_END = "<!-- generated-project-cards:end -->";
const SYNC_STATUS_PATTERN = /<p class="project-sync-status" id="project-sync-status">[\s\S]*?<\/p>/;

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const fetchRepositories = async () => {
  const repositories = [];
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "chicago-open-bioinformatics-site-sync",
  };

  if (token) {
    headers.Authorization = ["Bearer", token].join(" ");
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(API_URL);
    url.searchParams.set("q", `topic:${TOPIC} archived:false is:public`);
    url.searchParams.set("sort", "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed with ${response.status}: ${response.statusText}`);
    }

    const payload = await response.json();
    repositories.push(...payload.items);

    if (payload.items.length < 100) {
      break;
    }
  }

  return repositories
    .map((repository) => ({
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description?.trim() || "No repository description provided yet.",
      stars: repository.stargazers_count,
      topics: Array.isArray(repository.topics) ? repository.topics.filter((topic) => topic !== TOPIC) : [],
      updatedAt: repository.updated_at,
      url: repository.html_url,
    }))
    .sort((left, right) => {
      if (right.stars !== left.stars) {
        return right.stars - left.stars;
      }

      return left.fullName.localeCompare(right.fullName, "en");
    });
};

const renderCard = (repository) => {
  const tags = repository.topics.length
    ? repository.topics
        .slice(0, 6)
        .map((topic) => `          <li>${escapeHtml(topic)}</li>`)
        .join("\n")
    : "          <li>community repo</li>";

  return `        <article class="project-card" data-project-card>
          <span class="project-card__status">★ ${repository.stars} star${repository.stars === 1 ? "" : "s"}</span>
          <h3><a class="project-card__link" href="${escapeHtml(repository.url)}">${escapeHtml(repository.fullName)}</a></h3>
          <p>${escapeHtml(repository.description)}</p>
          <p class="project-card__meta">Updated ${new Date(repository.updatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}</p>
          <ul class="tag-list">
${tags}
          </ul>
        </article>`;
};

const renderCards = (repositories) => {
  if (!repositories.length) {
    return `        <article class="project-card project-card--placeholder">
          <span class="project-card__status">Watching GitHub</span>
          <h3>No tagged repositories found yet</h3>
          <p>Add the <code>${TOPIC}</code> topic to a public repository and it will appear here after the next sync.</p>
        </article>`;
  }

  return repositories.map(renderCard).join("\n\n");
};

const updateIndex = async () => {
  const repositories = await fetchRepositories();
  const indexHtml = await readFile(INDEX_PATH, "utf8");

  if (!indexHtml.includes(GENERATED_START) || !indexHtml.includes(GENERATED_END)) {
    throw new Error("Generated project markers were not found in index.html.");
  }

  const cards = renderCards(repositories);
  const syncDate = new Date().toISOString().slice(0, 10);
  const syncStatus = `<p class="project-sync-status" id="project-sync-status">\n        Automatically refreshed from public repositories tagged with the\n        <code>${TOPIC}</code> GitHub topic. Last synced ${syncDate}.\n      </p>`;

  const updatedIndex = indexHtml
    .replace(SYNC_STATUS_PATTERN, syncStatus)
    .replace(
      /<!-- generated-project-cards:start -->[\s\S]*?<!-- generated-project-cards:end -->/,
      `${GENERATED_START}\n${cards}\n        ${GENERATED_END}`,
    );

  await writeFile(INDEX_PATH, updatedIndex);
  console.log(`Updated index.html with ${repositories.length} tagged repositories.`);
};

updateIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
