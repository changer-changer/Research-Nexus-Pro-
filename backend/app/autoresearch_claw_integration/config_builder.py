"""
Config Builder: Constructs AutoResearchClaw's RCConfig from Research-Nexus Pro data.

AutoResearchClaw uses a complex RCConfig dataclass with nested sections for
research topic, LLM settings, experiment config, export settings, etc.

This module maps our simpler data models to AutoResearchClaw's config.
"""

import sys
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

_AUTO_CLAW_PATH = "/home/cuizhixing/AutoResearchClaw"
if _AUTO_CLAW_PATH not in sys.path:
    sys.path.insert(0, _AUTO_CLAW_PATH)

try:
    from researchclaw.config import RCConfig
except ImportError:
    logger.warning("AutoResearchClaw not available, using mock config")
    RCConfig = None


def build_rc_config_from_innovation(
    topic: str,
    innovation_data: Optional[Dict[str, Any]] = None,
    target_venue: str = "NeurIPS",
    experiment_mode: str = "simulated",  # sandbox, docker, simulated
    max_iterations: int = 3,
    time_budget_sec: int = 600,
    auto_approve_gates: bool = True,
) -> Any:
    """
    Build an AutoResearchClaw RCConfig from Research-Nexus Pro innovation data.

    Args:
        topic: Research topic string
        innovation_data: Optional innovation dict from our database
        target_venue: Target conference (NeurIPS, ICML, ICLR, etc.)
        experiment_mode: How to run experiments (simulated/sandbox/docker)
        max_iterations: Max refinement iterations
        time_budget_sec: Per-iteration time budget in seconds
        auto_approve_gates: Auto-approve gate stages (5, 9, 20)

    Returns:
        RCConfig object or dict fallback if AutoResearchClaw unavailable
    """

    if RCConfig is None:
        # Fallback: return a simple dict that mimics RCConfig structure
        return _build_fallback_config(
            topic, target_venue, experiment_mode,
            max_iterations, time_budget_sec, auto_approve_gates
        )

    try:
        # AutoResearchClaw's RCConfig.from_dict requires many fields
        config_dict = {
            "project": {
                "name": "research_nexus_pipeline",
                "mode": "docs-first",
            },
            "research": {
                "topic": topic,
                "domains": _extract_domains(topic, innovation_data),
                "daily_paper_count": 0,
                "quality_threshold": 0.0,
                "graceful_degradation": True,
            },
            "runtime": {
                "timezone": "UTC",
                "max_parallel_tasks": 1,
                "approval_timeout_hours": 12,
                "retry_limit": 0,
            },
            "notifications": {
                "channel": "none",
                "target": "",
                "on_stage_start": False,
                "on_stage_fail": False,
                "on_gate_required": True,
            },
            "knowledge_base": {
                "backend": "markdown",
                "root": "/tmp/research_nexus_kb",
                "obsidian_vault": "",
            },
            "openclaw_bridge": {
                "use_cron": False,
                "use_message": False,
                "use_memory": False,
                "use_sessions_spawn": False,
                "use_web_fetch": False,
                "use_browser": False,
            },
            "llm": {
                "provider": "anthropic",
                "base_url": "https://api.kimi.com/coding/",
                "api_key_env": "KIMI_API_KEY",
                "primary_model": "kimi-for-coding",
                "fallback_models": [],
                "max_tokens": 4096,
                "temperature": 0.7,
                "timeout_sec": 60,
            },
            "security": {
                "hitl_required_stages": [5, 9, 20] if not auto_approve_gates else [],
                "allow_publish_without_approval": False,
                "redact_sensitive_logs": True,
            },
            "experiment": {
                "mode": experiment_mode,
                "metric_key": "accuracy",
                "metric_direction": "maximize",
                "max_iterations": max_iterations,
                "time_budget_sec": time_budget_sec,
                "sandbox": {
                    "python_path": "python3",
                    "timeout_sec": time_budget_sec,
                },
                "repair": {
                    "enabled": True,
                    "max_cycles": 3,
                },
                "code_agent": {
                    "enabled": False,
                },
                "opencode": {
                    "enabled": False,
                },
            },
            "export": {
                "target_conference": target_venue.lower(),
                "authors": "Research-Nexus AI",
                "bib_file": "references.bib",
            },
            "prompts": {
                "custom_file": "",
            },
            "web_search": {
                "enabled": False,  # Disable to avoid external API dependencies
                "tavily_api_key": "",
                "tavily_api_key_env": "TAVILY_API_KEY",
                "enable_scholar": False,
                "enable_crawling": False,
                "enable_pdf_extraction": False,
                "max_web_results": 0,
                "max_scholar_results": 0,
                "max_crawl_urls": 0,
            },
            "metaclaw_bridge": {
                "enabled": False,
            },
            "memory": {
                "enabled": False,
            },
            "skills": {
                "enabled": False,
            },
            "knowledge_graph": {
                "enabled": False,
            },
            "multi_project": {
                "enabled": False,
            },
            "compute_servers": {
                "enabled": False,
            },
            "mcp": {
                "enabled": False,
            },
            "overleaf": {
                "enabled": False,
            },
            "server": {
                "enabled": False,
            },
            "dashboard": {
                "enabled": False,
            },
            "trends": {
                "enabled": False,
            },
            "copilot": {
                "enabled": False,
            },
            "quality_assessor": {
                "enabled": False,
            },
            "calendar": {
                "enabled": False,
            },
            "hitl": {
                "enabled": not auto_approve_gates,
                "mode": "gate-only" if not auto_approve_gates else "full-auto",
            },
        }

        # Build RCConfig from dict
        return RCConfig.from_dict(config_dict, check_paths=False)

    except Exception as e:
        logger.error(f"Failed to build RCConfig: {e}")
        return _build_fallback_config(
            topic, target_venue, experiment_mode,
            max_iterations, time_budget_sec, auto_approve_gates
        )


def _build_fallback_config(
    topic: str,
    target_venue: str,
    experiment_mode: str,
    max_iterations: int,
    time_budget_sec: int,
    auto_approve_gates: bool,
) -> Dict[str, Any]:
    """Build a fallback config dict when AutoResearchClaw is unavailable."""
    return {
        "research": {"topic": topic, "domains": []},
        "llm": {
            "provider": "anthropic",
            "base_url": "https://api.kimi.com/coding/",
            "api_key_env": "KIMI_API_KEY",
            "primary_model": "kimi-for-coding",
        },
        "experiment": {
            "mode": experiment_mode,
            "metric_key": "accuracy",
            "metric_direction": "maximize",
            "max_iterations": max_iterations,
            "time_budget_sec": time_budget_sec,
        },
        "export": {
            "target_conference": target_venue.lower(),
            "authors": "Research-Nexus AI",
        },
        "auto_approve_gates": auto_approve_gates,
    }


def _extract_domains(topic: str, innovation_data: Optional[Dict[str, Any]]) -> list:
    """Extract domain keywords from topic and innovation data."""
    domains = set()

    # From topic
    topic_lower = topic.lower()
    domain_keywords = {
        "reinforcement learning": "rl",
        "computer vision": "cv",
        "natural language processing": "nlp",
        "robotics": "robotics",
        "multi-agent": "multi_agent",
        "agent": "agent",
        "llm": "llm",
        "transformer": "transformer",
        "diffusion": "diffusion",
        "gan": "gan",
        "graph neural": "gnn",
        "tactile": "tactile",
        "sensor": "sensor",
    }
    for keyword, domain in domain_keywords.items():
        if keyword in topic_lower:
            domains.add(domain)

    # From innovation data
    if innovation_data:
        if "domain" in innovation_data:
            domains.add(innovation_data["domain"])
        if "domains" in innovation_data:
            for d in innovation_data["domains"]:
                domains.add(str(d).lower().replace(" ", "_"))

    if not domains:
        domains.add("general")

    return sorted(list(domains))
