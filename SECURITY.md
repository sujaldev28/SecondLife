# Security Policy

## Supported Versions

Security fixes are applied on the active `main` branch (`1.x` pre-release / active development).

| Version / Branch | Supported |
| :--- | :--- |
| `main` | Yes |
| Older snapshots | No |

## Reporting a Vulnerability

Please do **not** report suspected security vulnerabilities through public GitHub issues, pull requests, or discussions.

1. Use **GitHub Private Vulnerability Reporting / Security Advisories** on this repository (`Security` -> `Advisories` -> `New draft security advisory`) when enabled by the repository owner.
2. *(Repository Maintainer Note)* A dedicated security contact email (`security@...`) is not yet configured in repository metadata; add one here once provisioned.

When submitting a report, please include:
- A clear description of the vulnerability and affected component (`apps/web`, `apps/api`, `services/ai-analyzer`, `packages/shared`).
- Exact reproduction steps or a minimal proof of concept.
- Potential impact (e.g., cross-tenant access, privilege escalation, SSRF, archive traversal, webhook bypass, token leakage).
- Any suggested remediation if known.

## Responsible Disclosure Expectations

- Allow reasonable time for triage, reproduction, fix development, and verification before public disclosure.
- Do not test vulnerabilities against production deployments (`https://secondlife-delta.vercel.app/` or third-party infrastructure) using destructive payloads, automated scanners, credential stuffing, or unauthorized data extraction. Reproduce locally against your own instance whenever possible.

## Sensitive Information Handling

- Never commit `.env` files, database dumps, JWT secrets, OAuth client secrets, Razorpay merchant secrets, or user PII in issues, commits, or logs.
- Use placeholder tokens and synthetic test data in reproductions.
- Pino logging in `apps/api` redacts sensitive headers/fields, and secret findings in `services/ai-analyzer` redact detected credential literals before persistence.

## Security Response Expectations

After a report is received via private channels:
- Maintainers aim to acknowledge receipt, assess severity against the threat model documented in [`docs/SECURITY_ARCHITECTURE.md`](docs/SECURITY_ARCHITECTURE.md), validate a fix with automated security tests, and coordinate disclosure once patched.
- No software platform is guaranteed immune to defects or zero-day vulnerabilities; production operators should additionally review [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) and [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) before accepting live traffic.
