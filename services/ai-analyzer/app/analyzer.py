"""
SecondLife Isolated Technical & Commercial Asset Analyzer.
Performs static AST parsing, secret detection, dependency manifest extraction,
maintainability scoring, and transparent commercial revival estimation.
Never executes untrusted submitted code.
"""

from __future__ import annotations

import ast
import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


SECRET_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}"), "critical"),
    ("GitHub Personal Token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"), "critical"),
    ("Private Key Block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "critical"),
    (
        "Hardcoded Secret Assignment",
        re.compile(r"(?i)(?:api_key|secret_key|password|jwt_secret)\s*[:=]\s*['\"][A-Za-z0-9_\-]{12,}['\"]"),
        "high",
    ),
]

JS_SECURITY_PATTERNS: list[tuple[str, re.Pattern[str], str, str]] = [
    (
        "Dynamic code evaluation (eval/new Function)",
        re.compile(r"\b(?:eval|Function)\s*\("),
        "high",
        "Replace dynamic code evaluation with explicit parsers or safe dispatch maps.",
    ),
    (
        "Unsafe HTML injection (dangerouslySetInnerHTML / innerHTML)",
        re.compile(r"(?:dangerouslySetInnerHTML|\.innerHTML\s*=)"),
        "medium",
        "Sanitize untrusted HTML with DOMPurify or render structured React nodes.",
    ),
    (
        "Child process shell execution",
        re.compile(r"child_process\.(?:exec|execSync)\s*\("),
        "high",
        "Prefer execFile/spawn with shell:false and strict argument arrays.",
    ),
]

EXT_LANGUAGE_MAP: dict[str, str] = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".sql": "SQL",
    ".md": "Markdown",
    ".sh": "Shell",
}


@dataclass
class FileInput:
    path: str
    size: int
    content_preview: str = ""


@dataclass
class Finding:
    category: str
    severity: str
    title: str
    description: str
    file_path: str | None = None
    line_number: int | None = None
    evidence_snippet: str | None = None
    remediation: str | None = None


def _analyze_python_ast(file_path: str, source: str) -> tuple[dict[str, int], list[Finding]]:
    stats = {"functions": 0, "classes": 0, "docstrings": 0}
    findings: list[Finding] = []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return stats, findings

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            stats["functions"] += 1
            if ast.get_docstring(node):
                stats["docstrings"] += 1
        elif isinstance(node, ast.ClassDef):
            stats["classes"] += 1
            if ast.get_docstring(node):
                stats["docstrings"] += 1
        elif isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            if func_name in {"eval", "exec"}:
                findings.append(
                    Finding(
                        category="security_pattern",
                        severity="high",
                        title=f"Dangerous Python call: {func_name}()",
                        description=f"Static AST inspection detected {func_name}(), which enables arbitrary code execution if reached by untrusted input.",
                        file_path=file_path,
                        line_number=getattr(node, "lineno", None),
                        remediation="Use ast.literal_eval() or explicit structured parsing.",
                    )
                )
            elif func_name in {"system", "popen"}:
                findings.append(
                    Finding(
                        category="security_pattern",
                        severity="high",
                        title=f"Shell command call: {func_name}()",
                        description="Direct OS shell invocation detected via AST inspection.",
                        file_path=file_path,
                        line_number=getattr(node, "lineno", None),
                        remediation="Use subprocess.run(..., shell=False) with validated argument lists.",
                    )
                )
    return stats, findings


def _parse_dependencies(files: list[FileInput]) -> dict[str, Any]:
    deps: list[dict[str, str]] = []
    manifests: list[str] = []

    for f in files:
        lower = f.path.lower()
        if lower.endswith("package.json") and f.content_preview:
            manifests.append(f.path)
            try:
                pkg = json.loads(f.content_preview)
                for section in ("dependencies", "devDependencies"):
                    block = pkg.get(section, {})
                    if isinstance(block, dict):
                        for name, ver in block.items():
                            deps.append({"ecosystem": "npm", "name": str(name), "version": str(ver)})
            except json.JSONDecodeError:
                pass
        elif lower.endswith("requirements.txt") and f.content_preview:
            manifests.append(f.path)
            for line in f.content_preview.splitlines():
                clean = line.strip()
                if clean and not clean.startswith("#"):
                    parts = re.split(r"[=<>!~]+", clean, maxsplit=1)
                    deps.append(
                        {
                            "ecosystem": "PyPI",
                            "name": parts[0].strip(),
                            "version": parts[1].strip() if len(parts) > 1 else "unpinned",
                        }
                    )

    unpinned = [d for d in deps if d["version"] in {"*", "latest", "unpinned"}]
    return {
        "manifestsDetected": manifests,
        "totalDependencies": len(deps),
        "unpinnedDependencies": len(unpinned),
        "sampleDependencies": deps[:30],
    }


def analyze_asset_payload(payload: dict[str, Any]) -> dict[str, Any]:
    raw_files = payload.get("files") or []
    files = [
        FileInput(
            path=str(item.get("path", "")),
            size=int(item.get("size", 0)),
            content_preview=str(item.get("contentPreview") or ""),
        )
        for item in raw_files
    ]
    declared_stack: list[str] = [str(s) for s in (payload.get("techStack") or [])]
    primary_language = payload.get("primaryLanguage")
    description = str(payload.get("description") or "")
    doc_notes = str(payload.get("documentationNotes") or "")

    lang_counts: dict[str, int] = {}
    findings: list[Finding] = []
    total_loc = 0
    has_tests = False
    has_readme = bool(doc_notes.strip())
    has_ci = False
    py_stats = {"functions": 0, "classes": 0, "docstrings": 0}

    for f in files:
        lower = f.path.lower()
        if "test" in lower or "__tests__" in lower or lower.endswith(".spec.ts") or lower.endswith("_test.py"):
            has_tests = True
        if lower.endswith("readme.md") or lower.endswith("readme.txt"):
            has_readme = True
        if ".github/workflows" in lower or ".gitlab-ci" in lower:
            has_ci = True

        ext = ""
        if "." in lower.rsplit("/", 1)[-1]:
            ext = "." + lower.rsplit(".", 1)[-1]
        lang = EXT_LANGUAGE_MAP.get(ext)
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + max(1, f.size)

        if f.content_preview:
            lines = f.content_preview.splitlines()
            total_loc += len(lines)

            # Secret scanning
            for sec_title, pattern, severity in SECRET_PATTERNS:
                for idx, line in enumerate(lines, start=1):
                    if pattern.search(line):
                        findings.append(
                            Finding(
                                category="secret",
                                severity=severity,
                                title=f"Potential exposed credential: {sec_title}",
                                description="Pattern matching detected a probable secret literal in source files.",
                                file_path=f.path,
                                line_number=idx,
                                evidence_snippet="[REDACTED FOR SECURITY]",
                                remediation="Rotate the credential immediately and move configuration to environment variables.",
                            )
                        )
                        break

            # Python AST analysis
            if ext == ".py":
                stats, ast_findings = _analyze_python_ast(f.path, f.content_preview)
                py_stats["functions"] += stats["functions"]
                py_stats["classes"] += stats["classes"]
                py_stats["docstrings"] += stats["docstrings"]
                findings.extend(ast_findings)

            # JS/TS static security patterns
            if ext in {".js", ".jsx", ".ts", ".tsx"}:
                for title, pattern, severity, remediation in JS_SECURITY_PATTERNS:
                    for idx, line in enumerate(lines, start=1):
                        if pattern.search(line):
                            findings.append(
                                Finding(
                                    category="security_pattern",
                                    severity=severity,
                                    title=title,
                                    description="Static pattern check flagged potentially unsafe sink.",
                                    file_path=f.path,
                                    line_number=idx,
                                    remediation=remediation,
                                )
                            )
                            break

    dep_summary = _parse_dependencies(files)

    # Normalize language breakdown percentages
    total_lang_weight = sum(lang_counts.values())
    languages_breakdown: dict[str, int] = {}
    if total_lang_weight > 0:
        for lang, weight in lang_counts.items():
            languages_breakdown[lang] = round((weight / total_lang_weight) * 100)
    elif primary_language:
        languages_breakdown[str(primary_language)] = 100

    # Deterministic scoring model
    has_source_files = len(files) > 0
    critical_count = sum(1 for x in findings if x.severity == "critical")
    high_count = sum(1 for x in findings if x.severity == "high")
    medium_count = sum(1 for x in findings if x.severity == "medium")

    security_score = max(15, 94 - critical_count * 25 - high_count * 12 - medium_count * 5)
    documentation_score = 45 + (25 if has_readme else 0) + (15 if len(description) > 120 else 0) + (10 if py_stats["docstrings"] > 0 else 0)
    documentation_score = min(96, documentation_score)

    maintainability_score = 52 + (18 if has_tests else 0) + (10 if has_ci else 0) + (10 if dep_summary["manifestsDetected"] else 0)
    if dep_summary["unpinnedDependencies"] > 3:
        maintainability_score -= 8
    maintainability_score = max(25, min(95, maintainability_score))

    technical_score = round(0.4 * security_score + 0.35 * maintainability_score + 0.25 * documentation_score)

    confidence = 0.85 if has_source_files else 0.48
    known_limitations: list[str] = [
        "Dynamic runtime execution and test suite execution were not run in this static pass.",
    ]
    if not has_source_files:
        known_limitations.append(
            "No source archive files were attached; scores reflect declared metadata and documentation only (reduced confidence)."
        )

    # Commercial valuation model (transparent, documented assumptions)
    reusability_score = min(
        95,
        round(
            50
            + (15 if has_tests else 0)
            + (10 if has_readme else 0)
            + min(15, len(declared_stack) * 3)
            + (5 if technical_score >= 75 else 0)
        ),
    )
    commercial_opportunity_score = min(
        94,
        round(0.45 * reusability_score + 0.35 * technical_score + 0.20 * documentation_score),
    )

    complexity_factor = max(1.0, math.log10(max(100, total_loc + len(files) * 40)))
    base_revival_hours = round((110 - technical_score) * 1.8 * complexity_factor + 32)
    revival_hours_min = max(24, round(base_revival_hours * 0.8))
    revival_hours_max = max(revival_hours_min + 20, round(base_revival_hours * 1.35))

    hourly_rate_inr_minor_min = 250_000  # INR 2,500/hr
    hourly_rate_inr_minor_max = 380_000  # INR 3,800/hr
    revival_cost_min = revival_hours_min * hourly_rate_inr_minor_min
    revival_cost_max = revival_hours_max * hourly_rate_inr_minor_max

    # Conservative value estimate derived from replacement engineering effort minus revival remediation cost
    replacement_hours = max(180, round((total_loc / 25) + len(files) * 4 + 140))
    gross_replacement_minor = replacement_hours * 320_000
    suggested_val_min = max(5_000_000, round((gross_replacement_minor - revival_cost_max) * 0.45))
    suggested_val_max = max(suggested_val_min + 5_000_000, round((gross_replacement_minor - revival_cost_min) * 0.75))

    modernization_reqs: list[str] = []
    if not has_tests:
        modernization_reqs.append("Add automated unit/integration test coverage before production deployment.")
    if not has_ci:
        modernization_reqs.append("Configure CI/CD workflow and dependency vulnerability checks.")
    if critical_count > 0 or high_count > 0:
        modernization_reqs.append("Remediate flagged high/critical security & secret findings.")
    if dep_summary["unpinnedDependencies"] > 0:
        modernization_reqs.append("Pin unversioned dependencies and audit lockfiles.")
    if not modernization_reqs:
        modernization_reqs.append("Refresh runtime dependency minor versions and validate container build.")

    methods = ["Metadata & manifest extraction", "Secret & credential regex scan"]
    if has_source_files:
        methods.extend(["Python AST static inspection", "JS/TS security pattern scan", "Structural maintainability heuristic"])

    return {
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "engineMode": "deterministic_python_ast",
        "technicalReport": {
            "technicalScore": technical_score,
            "maintainabilityScore": maintainability_score,
            "securityScore": security_score,
            "documentationScore": documentation_score,
            "confidenceLevel": round(confidence, 2),
            "analysisMethods": methods,
            "dataSources": ["Uploaded source archive" if has_source_files else "Submitted asset metadata"],
            "architectureSummary": (
                f"Inspected {len(files)} files ({total_loc} lines sampled). "
                f"Detected languages: {', '.join(languages_breakdown.keys()) or 'Unspecified'}. "
                f"Tests present: {'Yes' if has_tests else 'No'}. CI config present: {'Yes' if has_ci else 'No'}."
            ),
            "reusableComponents": declared_stack[:6] or ["Core application module"],
            "dependencySummary": dep_summary,
            "knownLimitations": known_limitations,
            "languagesBreakdown": languages_breakdown,
            "linesOfCode": total_loc,
            "hasTests": has_tests,
            "hasReadme": has_readme,
            "hasCiConfig": has_ci,
        },
        "riskFindings": [
            {
                "category": f.category,
                "severity": f.severity,
                "title": f.title,
                "description": f.description,
                "filePath": f.file_path,
                "lineNumber": f.line_number,
                "evidenceSnippet": f.evidence_snippet,
                "remediation": f.remediation,
            }
            for f in findings
        ],
        "commercialReport": {
            "reusabilityScore": reusability_score,
            "commercialOpportunityScore": commercial_opportunity_score,
            "estimatedRevivalHoursMin": revival_hours_min,
            "estimatedRevivalHoursMax": revival_hours_max,
            "estimatedRevivalCostInrMin": revival_cost_min,
            "estimatedRevivalCostInrMax": revival_cost_max,
            "suggestedValueRangeInrMin": suggested_val_min,
            "suggestedValueRangeInrMax": suggested_val_max,
            "confidenceLevel": round(confidence * 0.92, 2),
            "targetSegments": ["B2B SaaS Engineering Teams", "Venture Studios", "System Integrators"],
            "industryApplications": ["Software Modernization", "Internal Tooling Acceleration"],
            "modernizationRequirements": modernization_reqs,
            "documentedAssumptions": [
                "Blended India engineering revival rate modeled at INR 2,500 - 3,800/hour.",
                "Replacement baseline derived from sampled LOC, file surface, and remediation effort.",
                "Commercial valuation assumes clear IP ownership and compatible licensing.",
            ],
            "uncertaintyFactors": [
                "Market demand elasticity varies by vertical and buyer urgency.",
                "Static analysis cannot verify live runtime throughput or proprietary business traction.",
            ],
        },
    }


def score_buyer_asset_match(requirement: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    req_techs = {t.lower() for t in (requirement.get("requiredTechnologies") or [])}
    req_cats = {c.lower() for c in (requirement.get("preferredCategories") or [])}
    req_types = set(requirement.get("preferredListingTypes") or [])
    min_score = int(requirement.get("minTechnicalScore") or 0)
    max_budget = requirement.get("maxBudgetMinor")

    asset_techs = {t.lower() for t in (candidate.get("techStack") or [])}
    if candidate.get("primaryLanguage"):
        asset_techs.add(str(candidate["primaryLanguage"]).lower())

    reasons: list[str] = []
    gaps: list[str] = []
    score = 35

    if req_techs:
        overlap = req_techs & asset_techs
        ratio = len(overlap) / len(req_techs)
        score += round(ratio * 35)
        if overlap:
            reasons.append(f"Technology match: {', '.join(sorted(overlap))}")
        missing = req_techs - asset_techs
        if missing:
            gaps.append(f"Missing requested stack items: {', '.join(sorted(missing))}")
    else:
        score += 20

    cat_slug = str(candidate.get("categorySlug") or "").lower()
    if req_cats and cat_slug in req_cats:
        score += 15
        reasons.append(f"Category matches requirement ({cat_slug})")
    elif req_cats:
        gaps.append(f"Category '{cat_slug}' outside preferred list")

    tech_score = int(candidate.get("technicalScore") or 0)
    if tech_score >= min_score:
        score += 10
        reasons.append(f"Technical score ({tech_score}) meets minimum ({min_score})")
    else:
        score -= 10
        gaps.append(f"Technical score ({tech_score}) below minimum ({min_score})")

    listing_type = candidate.get("listingType")
    if req_types and listing_type in req_types:
        score += 5
        reasons.append(f"Supports preferred arrangement ({listing_type})")

    price = candidate.get("askingPriceMinor")
    if max_budget is not None and price is not None:
        if int(price) <= int(max_budget):
            reasons.append("Asking price is within target budget")
        else:
            score -= 15
            gaps.append("Asking price exceeds target maximum budget")

    return {
        "matchScore": max(5, min(100, score)),
        "explanation": {"reasons": reasons, "gaps": gaps},
    }
