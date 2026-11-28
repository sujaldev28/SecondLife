from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .analyzer import analyze_asset_payload, score_buyer_asset_match

app = FastAPI(title="SecondLife AI Intelligence Service", version="1.0.0")

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "dev-internal-ai-service-token")

if APP_ENV == "production" and INTERNAL_TOKEN == "dev-internal-ai-service-token":
    raise RuntimeError("Production AI analyzer requires a non-default INTERNAL_SERVICE_TOKEN")


class AnalyzeRequest(BaseModel):
    assetId: str
    primaryLanguage: str | None = None
    techStack: list[str] = []
    description: str = ""
    documentationNotes: str | None = None
    files: list[dict[str, Any]] = []


class MatchRequest(BaseModel):
    requirement: dict[str, Any]
    candidate: dict[str, Any]


def _verify_internal_token(token: str | None) -> None:
    if not token or not hmac.compare_digest(token, INTERNAL_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid internal service token")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "secondlife-ai-analyzer"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest, x_internal_token: str | None = Header(default=None)) -> dict[str, Any]:
    _verify_internal_token(x_internal_token)
    return analyze_asset_payload(req.model_dump())


@app.post("/match")
def match(req: MatchRequest, x_internal_token: str | None = Header(default=None)) -> dict[str, Any]:
    _verify_internal_token(x_internal_token)
    return score_buyer_asset_match(req.requirement, req.candidate)
