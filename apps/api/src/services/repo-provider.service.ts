import { env } from '../config/env.js';
import { validateSafeExternalUrl } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

export interface RepoMetadataResult {
  provider: 'github' | 'gitlab' | 'bitbucket';
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  stars: number;
  forks: number;
  openIssues: number;
  archived: boolean;
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  lastCommitAt: string | null;
  description: string | null;
  rawSignals: Record<string, unknown>;
}

export interface DiscoveryCandidateResult {
  provider: 'github' | 'gitlab' | 'bitbucket';
  repoFullName: string;
  repoUrl: string;
  primaryLanguage: string | null;
  detectedLicense: string | null;
  inactivityDays: number;
  candidateScore: number;
  inactivitySignals: Record<string, unknown>;
}

function parseRepoCoordinates(url: URL, provider: string): { owner: string; repo: string } {
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/');
  if (parts.length < 2) {
    throw new BadRequestError(`Invalid ${provider} repository URL path`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function fetchRepositoryMetadata(
  repoUrl: string,
  providerHint?: string,
): Promise<RepoMetadataResult> {
  const parsed = validateSafeExternalUrl(repoUrl);
  const host = parsed.hostname.toLowerCase();

  let provider: 'github' | 'gitlab' | 'bitbucket';
  if (host === 'github.com' || providerHint === 'github') {
    provider = 'github';
  } else if (host === 'gitlab.com' || providerHint === 'gitlab') {
    provider = 'gitlab';
  } else if (host === 'bitbucket.org' || providerHint === 'bitbucket') {
    provider = 'bitbucket';
  } else {
    throw new BadRequestError('Unsupported repository host. Supported providers: github.com, gitlab.com, bitbucket.org');
  }

  const { owner, repo } = parseRepoCoordinates(parsed, provider);
  const timeout = AbortSignal.timeout(8000);

  if (provider === 'github') {
    if (host !== 'github.com') {
      throw new BadRequestError('GitHub provider requires github.com host');
    }
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SecondLife-Platform/1.0',
    };
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    const resp = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers,
      signal: timeout,
    });
    if (!resp.ok) {
      throw new BadRequestError(`GitHub API returned ${resp.status}. Ensure the repository exists and access is authorized.`);
    }
    const data = (await resp.json()) as Record<string, unknown>;
    const licenseObj = data.license as { spdx_id?: string } | null | undefined;
    return {
      provider: 'github',
      fullName: String(data.full_name || `${owner}/${repo}`),
      defaultBranch: String(data.default_branch || 'main'),
      isPrivate: Boolean(data.private),
      stars: Number(data.stargazers_count || 0),
      forks: Number(data.forks_count || 0),
      openIssues: Number(data.open_issues_count || 0),
      archived: Boolean(data.archived),
      primaryLanguage: data.language ? String(data.language) : null,
      licenseSpdx: licenseObj?.spdx_id ?? null,
      lastCommitAt: data.pushed_at ? String(data.pushed_at) : null,
      description: data.description ? String(data.description) : null,
      rawSignals: {
        hasWiki: Boolean(data.has_wiki),
        sizeKb: Number(data.size || 0),
        topics: Array.isArray(data.topics) ? data.topics : [],
      },
    };
  }

  if (provider === 'gitlab') {
    if (host !== 'gitlab.com') {
      throw new BadRequestError('GitLab provider requires gitlab.com host');
    }
    const encodedPath = encodeURIComponent(`${owner}/${repo}`);
    const headers: Record<string, string> = { 'User-Agent': 'SecondLife-Platform/1.0' };
    if (env.GITLAB_TOKEN) headers['PRIVATE-TOKEN'] = env.GITLAB_TOKEN;

    const resp = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`, {
      headers,
      signal: timeout,
    });
    if (!resp.ok) {
      throw new BadRequestError(`GitLab API returned ${resp.status}`);
    }
    const data = (await resp.json()) as Record<string, unknown>;
    return {
      provider: 'gitlab',
      fullName: String(data.path_with_namespace || `${owner}/${repo}`),
      defaultBranch: String(data.default_branch || 'main'),
      isPrivate: data.visibility === 'private',
      stars: Number(data.star_count || 0),
      forks: Number(data.forks_count || 0),
      openIssues: Number(data.open_issues_count || 0),
      archived: Boolean(data.archived),
      primaryLanguage: null,
      licenseSpdx: null,
      lastCommitAt: data.last_activity_at ? String(data.last_activity_at) : null,
      description: data.description ? String(data.description) : null,
      rawSignals: { visibility: data.visibility },
    };
  }

  // Bitbucket
  if (host !== 'bitbucket.org') {
    throw new BadRequestError('Bitbucket provider requires bitbucket.org host');
  }
  const headers: Record<string, string> = { 'User-Agent': 'SecondLife-Platform/1.0' };
  if (env.BITBUCKET_TOKEN) headers.Authorization = `Bearer ${env.BITBUCKET_TOKEN}`;
  const resp = await fetch(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers,
    signal: timeout,
  });
  if (!resp.ok) {
    throw new BadRequestError(`Bitbucket API returned ${resp.status}`);
  }
  const data = (await resp.json()) as Record<string, unknown>;
  const mainBranch = data.mainbranch as { name?: string } | undefined;
  return {
    provider: 'bitbucket',
    fullName: String(data.full_name || `${owner}/${repo}`),
    defaultBranch: String(mainBranch?.name || 'main'),
    isPrivate: Boolean(data.is_private),
    stars: 0,
    forks: 0,
    openIssues: 0,
    archived: false,
    primaryLanguage: data.language ? String(data.language) : null,
    licenseSpdx: null,
    lastCommitAt: data.updated_on ? String(data.updated_on) : null,
    description: data.description ? String(data.description) : null,
    rawSignals: {},
  };
}

export async function discoverInactiveCandidates(params: {
  provider: 'github';
  topicOrQuery: string;
  minInactivityDays: number;
  limit?: number;
}): Promise<{ candidates: DiscoveryCandidateResult[]; liveApiUsed: boolean; disclaimer: string }> {
  const disclaimer =
    'Inactivity signals indicate candidate status only and do NOT prove abandonment, ownership availability, or right to commercialize.';
  const cutoffDate = new Date(Date.now() - params.minInactivityDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const q = `${params.topicOrQuery} pushed:<${cutoffDate} stars:>=5`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SecondLife-Discovery/1.0',
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  try {
    const resp = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(params.limit ?? 10, 20)}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );

    if (!resp.ok) {
      return { candidates: [], liveApiUsed: false, disclaimer };
    }

    const body = (await resp.json()) as { items?: Array<Record<string, unknown>> };
    const items = body.items ?? [];
    const now = Date.now();

    const candidates: DiscoveryCandidateResult[] = items.map((item) => {
      const pushedAt = item.pushed_at ? Date.parse(String(item.pushed_at)) : now;
      const inactivityDays = Math.max(0, Math.round((now - pushedAt) / (1000 * 60 * 60 * 24)));
      const stars = Number(item.stargazers_count || 0);
      const archived = Boolean(item.archived);
      const licenseObj = item.license as { spdx_id?: string } | null | undefined;
      const score = Math.min(95, Math.round(40 + Math.min(30, stars / 10) + Math.min(25, inactivityDays / 30)));

      return {
        provider: 'github',
        repoFullName: String(item.full_name),
        repoUrl: String(item.html_url),
        primaryLanguage: item.language ? String(item.language) : null,
        detectedLicense: licenseObj?.spdx_id ?? null,
        inactivityDays,
        candidateScore: score,
        inactivitySignals: {
          daysSinceLastCommit: inactivityDays,
          stars,
          forks: Number(item.forks_count || 0),
          openIssues: Number(item.open_issues_count || 0),
          archived,
          disclaimer,
        },
      };
    });

    return { candidates, liveApiUsed: true, disclaimer };
  } catch {
    return { candidates: [], liveApiUsed: false, disclaimer };
  }
}
