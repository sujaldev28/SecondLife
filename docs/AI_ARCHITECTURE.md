# AI Architecture & Evaluation Pipeline

## Hybrid Deterministic + Isolated Python Intelligence
SecondLife separates deterministic static evaluation from optional generative enrichment and explicitly surfaces confidence levels, data sources, and limitations on every report.

### Pipeline Stages (`services/ai-analyzer/app/analyzer.py`)
1. **Safe Archive Inspection (`apps/api`)**: Verifies ZIP magic bytes, size ceiling (`AI_MAX_ARCHIVE_BYTES`), entry count (<= 5,000), decompression ceiling (<= 150 MB), compression ratio (<= 100:1), and rejects path traversal (`..`, absolute/drive paths, null bytes).
2. **Static Parsing & Language Breakdown**: Computes weighted language proportions, LOC sampled, test presence, README presence, and CI workflow presence.
3. **Python AST Inspection**: Uses Python's `ast` module (never executing submitted code) to count functions, classes, docstrings, and flag dangerous sinks (`eval`, `exec`, `os.system`, `os.popen`).
4. **JS/TS Security Pattern Scanning**: Flags `eval`/`new Function`, `dangerouslySetInnerHTML`/`innerHTML`, and `child_process.exec`.
5. **Credential & Secret Detection**: Scans for AWS access keys, GitHub tokens, PEM private keys, and hardcoded secrets, redacting matched literals in stored evidence.
6. **Dependency Manifest Extraction**: Parses `package.json` and `requirements.txt` to report dependency counts and unpinned versions.
7. **Commercial Revival Modeling**: Calculates transparent revival hour/INR ranges (modeled at INR 2,500–3,800/hour), replacement baseline, documented assumptions, uncertainty factors, and confidence score (lowered when source archives are absent).
8. **Human Evaluator Override**: Authorized `evaluator` or `platform_admin` roles can override commercial estimates via `POST /api/v1/reports/:commercialReportId/override` with mandatory documented reasoning and audit logging.
