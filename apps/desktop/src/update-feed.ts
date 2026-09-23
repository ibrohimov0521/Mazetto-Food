export type DesktopUpdateFeedConfig =
  | {
      provider: "github";
      owner: string;
      repo: string;
      releaseType: "release";
    }
  | {
      provider: "generic";
      url: string;
    };

const GITHUB_OWNER = "ibrohimov0521";
const GITHUB_REPO = "Mazetto-Food";

/**
 * Keep the built-in GitHub release flow, but allow Dokploy/media or an admin
 * managed generic feed to be supplied through MAZETTO_DESKTOP_UPDATE_URL.
 */
export function resolveDesktopUpdateFeed(
  feedUrl: string,
): DesktopUpdateFeedConfig {
  const normalized = feedUrl.trim();
  try {
    const parsed = new URL(normalized);
    const githubLatestDownload =
      parsed.hostname.toLowerCase() === "github.com" &&
      parsed.pathname.toLowerCase() ===
        `/ibrohimov0521/mazetto-food/releases/latest/download/`;

    if (githubLatestDownload) {
      return {
        provider: "github",
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        releaseType: "release",
      };
    }
  } catch {
    // electron-updater will report the malformed generic URL during checking.
  }

  return {
    provider: "generic",
    url: normalized.endsWith("/") ? normalized : `${normalized}/`,
  };
}
