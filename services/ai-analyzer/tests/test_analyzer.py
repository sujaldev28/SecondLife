from app.analyzer import analyze_asset_payload, score_buyer_asset_match


def test_python_ast_and_secret_detection():
    payload = {
        "primaryLanguage": "Python",
        "techStack": ["Python", "FastAPI"],
        "description": "A modular FastAPI microservice for invoice parsing with automated test coverage.",
        "files": [
            {
                "path": "app/service.py",
                "size": 450,
                "contentPreview": (
                    '"""Invoice parser service."""\n'
                    "def parse(data):\n"
                    '    """Parse payload safely."""\n'
                    "    return eval(data)\n"
                ),
            },
            {
                "path": "config.py",
                "size": 120,
                "contentPreview": 'AWS_KEY = "AKIA1234567890ABCDEF"\n',
            },
            {
                "path": "tests/test_service.py",
                "size": 100,
                "contentPreview": "def test_ok():\n    assert True\n",
            },
            {
                "path": "README.md",
                "size": 250,
                "contentPreview": "# Invoice Parser\nSetup instructions.",
            },
            {
                "path": "requirements.txt",
                "size": 80,
                "contentPreview": "fastapi==0.115.6\npydantic>=2.0\n",
            },
        ],
    }

    result = analyze_asset_payload(payload)
    tech = result["technicalReport"]
    comm = result["commercialReport"]
    findings = result["riskFindings"]

    assert tech["hasTests"] is True
    assert tech["hasReadme"] is True
    assert tech["dependencySummary"]["totalDependencies"] == 2
    assert any(f["category"] == "secret" and f["severity"] == "critical" for f in findings)
    assert any("eval()" in f["title"] for f in findings)
    assert comm["estimatedRevivalHoursMin"] < comm["estimatedRevivalHoursMax"]
    assert len(comm["documentedAssumptions"]) >= 2
    assert len(comm["uncertaintyFactors"]) >= 2


def test_buyer_asset_matching_explains_reasons_and_gaps():
    req = {
        "requiredTechnologies": ["TypeScript", "PostgreSQL"],
        "preferredCategories": ["fintech-billing"],
        "minTechnicalScore": 75,
        "maxBudgetMinor": 50000000,
    }
    cand = {
        "techStack": ["TypeScript", "Node.js", "PostgreSQL"],
        "categorySlug": "fintech-billing",
        "technicalScore": 86,
        "askingPriceMinor": 45000000,
    }
    res = score_buyer_asset_match(req, cand)
    assert res["matchScore"] >= 85
    assert len(res["explanation"]["reasons"]) >= 3
    assert res["explanation"]["gaps"] == []
