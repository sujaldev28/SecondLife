import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface AnalysisInputPayload {
  assetId: string;
  primaryLanguage: string | null;
  techStack: string[];
  description: string;
  documentationNotes: string | null;
  files: Array<{ path: string; size: number; contentPreview?: string }>;
}

export interface AnalysisOutput {
  analyzedAt: string;
  engineMode: string;
  technicalReport: {
    technicalScore: number;
    maintainabilityScore: number;
    securityScore: number;
    documentationScore: number;
    confidenceLevel: number;
    analysisMethods: string[];
    dataSources: string[];
    architectureSummary: string;
    reusableComponents: string[];
    dependencySummary: Record<string, unknown>;
    knownLimitations: string[];
    languagesBreakdown: Record<string, number>;
    linesOfCode: number;
    hasTests: boolean;
    hasReadme: boolean;
    hasCiConfig: boolean;
  };
  riskFindings: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    filePath?: string | null;
    lineNumber?: number | null;
    evidenceSnippet?: string | null;
    remediation?: string | null;
  }>;
  commercialReport: {
    reusabilityScore: number;
    commercialOpportunityScore: number;
    estimatedRevivalHoursMin: number;
    estimatedRevivalHoursMax: number;
    estimatedRevivalCostInrMin: number;
    estimatedRevivalCostInrMax: number;
    suggestedValueRangeInrMin: number;
    suggestedValueRangeInrMax: number;
    confidenceLevel: number;
    targetSegments: string[];
    industryApplications: string[];
    modernizationRequirements: string[];
    documentedAssumptions: string[];
    uncertaintyFactors: string[];
  };
}

function buildAiAnalyzerUrl(endpointPath: string): URL {
  // Supports full URLs (`https://...` / `http://...`) and Render `hostport` values (`service-name:10000`).
  const rawBase = (process.env.AI_ANALYZER_URL || env.AI_SERVICE_URL).trim();
  const baseUrl = /^https?:\/\//i.test(rawBase) ? rawBase : `http://${rawBase}`;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(endpointPath.replace(/^\/+/, ''), normalizedBase);
}

/**
 * Calls the isolated Python FastAPI AI analyzer when reachable; otherwise performs
 * deterministic local static inspection in Node and explicitly labels engineMode & limitations.
 */
export async function runAssetAnalysisPipeline(payload: AnalysisInputPayload): Promise<AnalysisOutput> {
  try {
    const resp = await fetch(buildAiAnalyzerUrl('analyze'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': env.INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.AI_ANALYSIS_TIMEOUT_SECONDS * 1000),
    });
    if (resp.ok) {
      return (await resp.json()) as AnalysisOutput;
    }
    logger.warn({ status: resp.status }, 'Python AI service returned non-200; using deterministic Node fallback');
  } catch (err) {
    logger.info({ err: (err as Error).message }, 'Python AI service unreachable; running deterministic static fallback');
  }

  // Deterministic local static analyzer fallback (never fabricates LLM/ML results)
  const findings: AnalysisOutput['riskFindings'] = [];
  let totalLoc = 0;
  let hasTests = false;
  let hasReadme = Boolean(payload.documentationNotes?.trim());
  let hasCi = false;
  const langWeights: Record<string, number> = {};

  const secretRegexes: Array<[string, RegExp, string]> = [
    ['AWS Access Key', /AKIA[0-9A-Z]{16}/, 'critical'],
    ['GitHub Token', /gh[pousr]_[A-Za-z0-9_]{20,}/, 'critical'],
    ['Private Key Block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'critical'],
  ];

  for (const f of payload.files) {
    const lower = f.path.toLowerCase();
    if (lower.includes('test') || lower.endsWith('.spec.ts') || lower.endsWith('_test.py')) hasTests = true;
    if (lower.endsWith('readme.md')) hasReadme = true;
    if (lower.includes('.github/workflows')) hasCi = true;

    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust',
      '.java': 'Java',
    };
    const lang = langMap[ext];
    if (lang) langWeights[lang] = (langWeights[lang] || 0) + Math.max(1, f.size);

    if (f.contentPreview) {
      const lines = f.contentPreview.split('\n');
      totalLoc += lines.length;
      for (const [title, rx, severity] of secretRegexes) {
        const lineIdx = lines.findIndex((l) => rx.test(l));
        if (lineIdx !== -1) {
          findings.push({
            category: 'secret',
            severity,
            title: `Potential exposed credential: ${title}`,
            description: 'Deterministic secret pattern detected in uploaded source file.',
            filePath: f.path,
            lineNumber: lineIdx + 1,
            evidenceSnippet: '[REDACTED]',
            remediation: 'Revoke credential immediately and move to environment configuration.',
          });
        }
      }
      if (/\beval\s*\(/.test(f.contentPreview)) {
        findings.push({
          category: 'security_pattern',
          severity: 'high',
          title: 'Dynamic code evaluation (eval)',
          description: 'Detected eval() invocation which poses code-injection risk.',
          filePath: f.path,
          remediation: 'Replace eval() with structured parsing.',
        });
      }
    }
  }

  const totalWeight = Object.values(langWeights).reduce((a, b) => a + b, 0);
  const languagesBreakdown: Record<string, number> = {};
  if (totalWeight > 0) {
    for (const [k, v] of Object.entries(langWeights)) {
      languagesBreakdown[k] = Math.round((v / totalWeight) * 100);
    }
  } else if (payload.primaryLanguage) {
    languagesBreakdown[payload.primaryLanguage] = 100;
  }

  const criticals = findings.filter((x) => x.severity === 'critical').length;
  const highs = findings.filter((x) => x.severity === 'high').length;
  const securityScore = Math.max(20, 92 - criticals * 25 - highs * 12);
  const documentationScore = Math.min(92, 45 + (hasReadme ? 25 : 0) + (payload.description.length > 100 ? 15 : 0));
  const maintainabilityScore = Math.min(92, 52 + (hasTests ? 20 : 0) + (hasCi ? 10 : 0));
  const technicalScore = Math.round(0.4 * securityScore + 0.35 * maintainabilityScore + 0.25 * documentationScore);
  const hasFiles = payload.files.length > 0;
  const confidence = hasFiles ? 0.78 : 0.45;

  const reusabilityScore = Math.min(92, 50 + (hasTests ? 15 : 0) + (hasReadme ? 10 : 0) + Math.min(15, payload.techStack.length * 3));
  const commercialOpportunityScore = Math.round(0.45 * reusabilityScore + 0.35 * technicalScore + 0.2 * documentationScore);

  const revivalHoursMin = Math.max(24, Math.round((110 - technicalScore) * 1.6));
  const revivalHoursMax = revivalHoursMin + 48;
  const revivalCostMin = revivalHoursMin * 250_000;
  const revivalCostMax = revivalHoursMax * 360_000;

  return {
    analyzedAt: new Date().toISOString(),
    engineMode: 'deterministic_node_fallback',
    technicalReport: {
      technicalScore,
      maintainabilityScore,
      securityScore,
      documentationScore,
      confidenceLevel: confidence,
      analysisMethods: ['Deterministic secret regex scan', 'Static sink & structure scan', 'Metadata evaluation'],
      dataSources: [hasFiles ? 'Uploaded source archive' : 'Submitted asset metadata'],
      architectureSummary: `Inspected ${payload.files.length} files (${totalLoc} lines sampled). Python AST worker offline; deterministic fallback applied.`,
      reusableComponents: payload.techStack.slice(0, 6).length ? payload.techStack.slice(0, 6) : ['Core codebase'],
      dependencySummary: { totalDependencies: 0, note: 'Detailed dependency tree requires Python analyzer or manifest upload.' },
      knownLimitations: [
        'Python FastAPI AST service was unavailable during this run; deterministic fallback executed.',
        ...(hasFiles ? [] : ['No source archive attached; scores based solely on metadata (lower confidence).']),
      ],
      languagesBreakdown,
      linesOfCode: totalLoc,
      hasTests,
      hasReadme,
      hasCiConfig: hasCi,
    },
    riskFindings: findings,
    commercialReport: {
      reusabilityScore,
      commercialOpportunityScore,
      estimatedRevivalHoursMin: revivalHoursMin,
      estimatedRevivalHoursMax: revivalHoursMax,
      estimatedRevivalCostInrMin: revivalCostMin,
      estimatedRevivalCostInrMax: revivalCostMax,
      suggestedValueRangeInrMin: 12_000_000,
      suggestedValueRangeInrMax: 35_000_000,
      confidenceLevel: Number((confidence * 0.9).toFixed(2)),
      targetSegments: ['SaaS Engineering Teams', 'Technology Startups'],
      industryApplications: ['Internal Acceleration', 'Commercial Modernization'],
      modernizationRequirements: [
        ...(hasTests ? [] : ['Establish automated test coverage']),
        ...(findings.length ? ['Remediate flagged security/secret findings'] : ['Refresh dependency lockfiles']),
      ],
      documentedAssumptions: [
        'Blended engineering revival rate modeled at INR 2,500 - 3,600/hour.',
        'Confidence adjusted downward when source archive is absent.',
      ],
      uncertaintyFactors: [
        'Actual commercial valuation depends on verified buyer demand and license compatibility.',
      ],
    },
  };
}
