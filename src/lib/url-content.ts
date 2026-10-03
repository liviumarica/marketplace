/**
 * Fetches textual content from a URL so the AI listing autopilot can turn it
 * into structured listing data. GitHub repos get special treatment — we pull
 * the README through the GitHub API, which is far richer than the HTML page.
 */

/** Strip HTML tags + collapse whitespace so the LLM gets clean text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect a github.com/owner/repo URL and return its parts. */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/**
 * Return up to `maxChars` of text describing whatever lives at `url`.
 * Throws with a readable message when the URL can't be fetched.
 */
export async function fetchUrlContent(
  url: string,
  maxChars = 12_000,
): Promise<string> {
  const gh = parseGitHubUrl(url);

  if (gh) {
    // GitHub API: fetch README + repo metadata — no token needed for public repos.
    const [repoRes, readmeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`),
      fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/readme`, {
        headers: { Accept: "application/vnd.github.raw" },
      }),
    ]);
    const parts: string[] = [];
    if (repoRes.ok) {
      const repo = (await repoRes.json()) as {
        name?: string;
        description?: string;
        language?: string;
        topics?: string[];
        homepage?: string;
      };
      parts.push(
        `Repository: ${repo.name}\nDescription: ${repo.description ?? "n/a"}\n` +
          `Primary language: ${repo.language ?? "n/a"}\n` +
          `Topics: ${(repo.topics ?? []).join(", ")}\nHomepage: ${repo.homepage ?? "n/a"}`,
      );
    }
    if (readmeRes.ok) {
      parts.push(`README:\n${await readmeRes.text()}`);
    }
    if (parts.length === 0) {
      throw new Error(`Could not fetch GitHub repository ${gh.owner}/${gh.repo}`);
    }
    return parts.join("\n\n").slice(0, maxChars);
  }

  // Generic URL — fetch HTML and strip it to text.
  const res = await fetch(url, {
    headers: { "User-Agent": "AgentBay-ListingBot/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Could not fetch ${url} (HTTP ${res.status})`);
  }
  return htmlToText(await res.text()).slice(0, maxChars);
}
