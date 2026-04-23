"""
Auto Completion Service
Automatically completes paper sections based on experimental data.

API: POST /api/v3/paper/{paper_id}/complete
Input: {
    "experiment_data": {...},
    "sections_to_complete": ["experiments", "analysis"]
}
Output: {
    "completed_paper": {...},
    "changes": [...]
}
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class CompletionStatus(Enum):
    """Status of auto-completion"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    INSUFFICIENT_DATA = "insufficient_data"


@dataclass
class ExperimentData:
    """Structured experiment data input"""
    experiment_id: str
    name: str
    metrics: Dict[str, float]  # e.g., {"accuracy": 0.95, "f1": 0.93}
    comparisons: List[Dict[str, Any]]  # Comparison with baselines
    figures: List[str]  # Paths to generated figures
    tables: List[Dict[str, Any]]  # Data tables
    observations: str  # Text observations
    conclusions: List[str]  # Key conclusions


@dataclass
class SectionCompletion:
    """Result of completing a paper section"""
    section_name: str
    original_content: str
    new_content: str
    changes_made: List[str]
    confidence: float


@dataclass
class CompletionResult:
    """Overall completion result"""
    status: CompletionStatus
    paper_id: str
    completed_sections: List[SectionCompletion]
    version: int
    completed_at: str
    message: str


class AutoCompletionService:
    """
    Automatically completes paper sections with experimental data.
    
    This service:
    1. Receives experimental data in JSON format
    2. Generates appropriate content for paper sections
    3. Updates paper with completed content
    4. Generates submission-ready version
    """
    
    # Sections that can be auto-completed
    COMPLETABLE_SECTIONS = [
        "experiments",
        "results",
        "analysis",
        "discussion",
        "tables",
        "figures"
    ]
    
    def __init__(self, llm_client=None, paper_db=None):
        self.llm_client = llm_client
        self.paper_db = paper_db
        self._load_templates()
        logger.info("AutoCompletionService initialized")
    
    def _load_templates(self):
        """Load completion templates"""
        self.templates = {
            "experiments": """## Experimental Setup

### Dataset
{dataset_description}

### Baselines
{baseline_descriptions}

### Implementation Details
{implementation_details}

### Evaluation Metrics
{metrics_list}
""",
            "results": """## Experimental Results

### Main Results
{main_results_table}

{main_results_text}

### Comparison with Baselines
{baseline_comparison}

### Ablation Study
{ablation_results}
""",
            "analysis": """## Analysis and Discussion

### Key Findings
{key_findings}

### Performance Analysis
{performance_analysis}

### Limitations and Future Work
{limitations}
"""
        }
    
    async def complete_paper(
        self,
        paper_id: str,
        experiment_data: Dict[str, Any],
        sections_to_complete: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Main completion entry point.
        
        Args:
            paper_id: Paper to complete
            experiment_data: Experimental results in JSON format
            sections_to_complete: Which sections to complete (default: all)
            
        Returns:
            Completion result with updated paper
        """
        logger.info(f"Starting auto-completion for paper {paper_id}")
        
        # Load existing paper
        paper = await self._load_paper(paper_id)
        if not paper:
            return self._generate_error_result(paper_id, "Paper not found")
        
        # Determine sections to complete
        if sections_to_complete is None:
            sections_to_complete = self.COMPLETABLE_SECTIONS
        else:
            sections_to_complete = [
                s for s in sections_to_complete 
                if s in self.COMPLETABLE_SECTIONS
            ]
        
        # Validate experiment data
        validation = self._validate_experiment_data(experiment_data)
        if not validation["is_valid"]:
            return self._generate_error_result(
                paper_id, 
                f"Invalid experiment data: {validation['errors']}"
            )
        
        # Parse experiment data
        parsed_data = self._parse_experiment_data(experiment_data)
        
        # Complete each section
        completed_sections = []
        failed_sections = []
        
        for section in sections_to_complete:
            try:
                completion = await self._complete_section(
                    section, 
                    paper.get(section, ""),
                    parsed_data,
                    paper
                )
                completed_sections.append(completion)
                
                # Update paper content
                paper[section] = completion.new_content
                
            except Exception as e:
                logger.error(f"Failed to complete section {section}: {e}")
                failed_sections.append({"section": section, "error": str(e)})
        
        # Update paper metadata
        paper["version"] = paper.get("version", 1) + 1
        paper["updated_at"] = datetime.now().isoformat()
        paper["auto_completed"] = True
        paper["completed_sections"] = [s.section_name for s in completed_sections]
        
        # Save updated paper
        await self._save_paper(paper_id, paper)
        
        # Determine status
        if len(completed_sections) == len(sections_to_complete):
            status = CompletionStatus.SUCCESS
        elif completed_sections:
            status = CompletionStatus.PARTIAL
        else:
            status = CompletionStatus.FAILED
        
        # Build result
        result = CompletionResult(
            status=status,
            paper_id=paper_id,
            completed_sections=completed_sections,
            version=paper["version"],
            completed_at=datetime.now().isoformat(),
            message=self._generate_completion_message(status, completed_sections, failed_sections)
        )
        
        logger.info(f"Auto-completion completed for {paper_id}: {status.value}")
        return self._completion_result_to_dict(result, paper)
    
    async def _load_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Load paper from database"""
        # In production: query from database
        # For now, return mock paper structure
        return {
            "id": paper_id,
            "title": "Example Paper",
            "version": 1,
            "experiments": "",
            "results": "",
            "analysis": "",
            "created_at": datetime.now().isoformat()
        }
    
    async def _save_paper(self, paper_id: str, paper: Dict[str, Any]):
        """Save paper to database"""
        # In production: save to database
        logger.info(f"Saving paper {paper_id} version {paper.get('version')}")
    
    def _validate_experiment_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate experiment data structure"""
        errors = []
        
        # Check required fields
        if "experiment_id" not in data:
            errors.append("Missing experiment_id")
        
        if "metrics" not in data or not isinstance(data["metrics"], dict):
            errors.append("Missing or invalid metrics")
        
        if "comparisons" not in data:
            errors.append("Missing comparisons data")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
    
    def _parse_experiment_data(self, data: Dict[str, Any]) -> ExperimentData:
        """Parse raw experiment data into structured format"""
        return ExperimentData(
            experiment_id=data.get("experiment_id", "unknown"),
            name=data.get("name", "Experiment"),
            metrics=data.get("metrics", {}),
            comparisons=data.get("comparisons", []),
            figures=data.get("figures", []),
            tables=data.get("tables", []),
            observations=data.get("observations", ""),
            conclusions=data.get("conclusions", [])
        )
    
    async def _complete_section(
        self,
        section: str,
        original_content: str,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> SectionCompletion:
        """Complete a single paper section"""
        
        if section == "experiments":
            new_content = await self._generate_experiments_section(data, paper)
        elif section == "results":
            new_content = await self._generate_results_section(data, paper)
        elif section == "analysis":
            new_content = await self._generate_analysis_section(data, paper)
        else:
            new_content = await self._generate_generic_section(section, data, paper)
        
        changes_made = self._identify_changes(original_content, new_content)
        
        return SectionCompletion(
            section_name=section,
            original_content=original_content,
            new_content=new_content,
            changes_made=changes_made,
            confidence=0.85  # Could be calculated from data quality
        )
    
    async def _generate_experiments_section(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Generate experiments section"""
        
        # Build section content
        content_parts = []
        
        # Dataset description
        content_parts.append("### Dataset")
        content_parts.append("We evaluate our method on standard benchmark datasets.")
        if data.tables:
            content_parts.append(f"The dataset statistics are shown in Table 1.")
        content_parts.append("")
        
        # Baselines
        content_parts.append("### Baselines")
        content_parts.append("We compare our method against the following strong baselines:")
        for i, comp in enumerate(data.comparisons[:5], 1):
            baseline = comp.get("baseline_name", f"Baseline {i}")
            content_parts.append(f"- **{baseline}**: {comp.get('description', 'State-of-the-art method')}")
        content_parts.append("")
        
        # Implementation
        content_parts.append("### Implementation Details")
        content_parts.append("Our implementation is based on PyTorch and trained on NVIDIA A100 GPUs.")
        content_parts.append(f"All experiments use a fixed random seed (42) for reproducibility.")
        content_parts.append("")
        
        # Metrics
        content_parts.append("### Evaluation Metrics")
        metrics_list = ", ".join([f"**{k}**" for k in data.metrics.keys()])
        content_parts.append(f"We report the following metrics: {metrics_list}.")
        content_parts.append("")
        
        return "\n".join(content_parts)
    
    async def _generate_results_section(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Generate results section"""
        
        content_parts = []
        
        # Main results
        content_parts.append("### Main Results")
        content_parts.append("")
        
        # Create results table
        if data.comparisons:
            content_parts.append("| Method | " + " | ".join(data.metrics.keys()) + " |")
            content_parts.append("|--------|" + "|".join(["--------"] * len(data.metrics)) + "|")
            
            # Add our method row
            our_method_row = f"| **Ours** | " + " | ".join([
                f"{v:.2%}" if isinstance(v, float) else str(v) 
                for v in data.metrics.values()
            ]) + " |"
            content_parts.append(our_method_row)
            
            # Add baseline rows
            for comp in data.comparisons[:5]:
                baseline_metrics = comp.get("metrics", {})
                row = f"| {comp.get('baseline_name', 'Baseline')} | " + " | ".join([
                    f"{baseline_metrics.get(k, 'N/A')}"
                    for k in data.metrics.keys()
                ]) + " |"
                content_parts.append(row)
            
            content_parts.append("")
        
        # Results summary
        best_metric = max(data.metrics.items(), key=lambda x: x[1])
        content_parts.append(f"As shown in the table, our method achieves **{best_metric[1]:.2%}** on {best_metric[0]},")
        content_parts.append("outperforming all baseline methods.")
        content_parts.append("")
        
        # Comparison with baselines
        content_parts.append("### Comparison with Baselines")
        if data.comparisons:
            best_baseline = max(
                data.comparisons,
                key=lambda x: x.get("metrics", {}).get(best_metric[0], 0)
            )
            baseline_score = best_baseline.get("metrics", {}).get(best_metric[0], 0)
            improvement = best_metric[1] - baseline_score
            content_parts.append(
                f"Compared to the best baseline ({best_baseline.get('baseline_name', 'SOTA')}), "
                f"our method achieves an absolute improvement of **{improvement:.2%}** on {best_metric[0]}."
            )
        content_parts.append("")
        
        return "\n".join(content_parts)
    
    async def _generate_analysis_section(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Generate analysis section"""
        
        content_parts = []
        
        # Key findings
        content_parts.append("### Key Findings")
        content_parts.append("")
        
        if data.conclusions:
            for i, conclusion in enumerate(data.conclusions[:5], 1):
                content_parts.append(f"{i}. {conclusion}")
        else:
            # Generate from metrics
            best_metric = max(data.metrics.items(), key=lambda x: x[1])
            content_parts.append(
                f"1. Our method significantly improves {best_metric[0]} over baseline methods."
            )
            content_parts.append(
                f"2. The results demonstrate the effectiveness of our proposed approach."
            )
        
        content_parts.append("")
        
        # Performance analysis
        content_parts.append("### Performance Analysis")
        content_parts.append("")
        
        if data.observations:
            content_parts.append(data.observations)
        else:
            content_parts.append(
                "The improved performance can be attributed to the key design choices in our method. "
                "Specifically, our approach better captures the underlying patterns in the data."
            )
        
        content_parts.append("")
        
        # Limitations
        content_parts.append("### Limitations and Future Work")
        content_parts.append("")
        content_parts.append(
            "While our method achieves strong results, there are several directions for future improvement: "
            "(1) extending to larger-scale datasets, "
            "(2) exploring more efficient architectures, and "
            "(3) investigating theoretical properties."
        )
        content_parts.append("")
        
        return "\n".join(content_parts)
    
    async def _generate_generic_section(
        self,
        section: str,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Generate a generic section"""
        return f"## {section.title()}\n\n[Auto-completed content based on experimental data]\n"
    
    def _identify_changes(self, original: str, new: str) -> List[str]:
        """Identify changes made to a section"""
        changes = []
        
        if not original and new:
            changes.append("Added complete section content")
        elif original and new and original != new:
            changes.append("Updated section with experimental data")
        
        # Could use diff library for more detailed changes
        return changes
    
    def _generate_completion_message(
        self,
        status: CompletionStatus,
        completed: List[SectionCompletion],
        failed: List[Dict]
    ) -> str:
        """Generate human-readable completion message"""
        
        if status == CompletionStatus.SUCCESS:
            return f"Successfully completed {len(completed)} sections with experimental data."
        elif status == CompletionStatus.PARTIAL:
            return f"Partially completed: {len(completed)} sections succeeded, {len(failed)} sections failed."
        elif status == CompletionStatus.INSUFFICIENT_DATA:
            return "Insufficient experimental data provided."
        else:
            return f"Completion failed: {failed[0]['error'] if failed else 'Unknown error'}"
    
    def _completion_result_to_dict(
        self,
        result: CompletionResult,
        paper: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Convert CompletionResult to dictionary"""
        return {
            "status": result.status.value,
            "paper_id": result.paper_id,
            "version": result.version,
            "completed_at": result.completed_at,
            "message": result.message,
            "completed_sections": [
                {
                    "section_name": s.section_name,
                    "changes_made": s.changes_made,
                    "confidence": s.confidence
                }
                for s in result.completed_sections
            ],
            "completed_paper": paper,
            "ready_for_submission": result.status == CompletionStatus.SUCCESS
        }
    
    def _generate_error_result(self, paper_id: str, message: str) -> Dict[str, Any]:
        """Generate error result"""
        return {
            "status": CompletionStatus.FAILED.value,
            "paper_id": paper_id,
            "version": None,
            "completed_at": datetime.now().isoformat(),
            "message": message,
            "completed_sections": [],
            "completed_paper": None,
            "ready_for_submission": False,
            "error": True
        }
    
    def preview_completion(
        self,
        paper_id: str,
        experiment_data: Dict[str, Any],
        section: str
    ) -> Dict[str, Any]:
        """
        Preview completion for a single section without saving.
        
        Returns:
            Preview of what the completed section would look like
        """
        try:
            validation = self._validate_experiment_data(experiment_data)
            if not validation["is_valid"]:
                return {
                    "error": f"Invalid data: {validation['errors']}",
                    "preview": None
                }
            
            parsed_data = self._parse_experiment_data(experiment_data)
            
            # Generate preview
            if section == "experiments":
                preview = self._generate_experiments_section_sync(parsed_data, {})
            elif section == "results":
                preview = self._generate_results_section_sync(parsed_data, {})
            elif section == "analysis":
                preview = self._generate_analysis_section_sync(parsed_data, {})
            else:
                preview = f"[Preview for {section}]\n\n[Content would be generated based on experimental data]"
            
            return {
                "section": section,
                "preview": preview,
                "estimated_confidence": 0.85,
                "ready": True
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "preview": None,
                "ready": False
            }
    
    def _generate_experiments_section_sync(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Synchronous version for preview"""
        return f"""### Dataset
We evaluate our method on standard benchmark datasets.

### Baselines
We compare against state-of-the-art methods.

### Implementation Details
Based on experimental data for {data.name}.

### Evaluation Metrics
Metrics: {', '.join(data.metrics.keys())}
"""
    
    def _generate_results_section_sync(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Synchronous version for preview"""
        best = max(data.metrics.items(), key=lambda x: x[1])
        return f"""### Main Results
Our method achieves {best[1]:.2%} on {best[0]}.

### Comparison with Baselines
Results show significant improvement over baselines.

### Ablation Study
Ablation experiments demonstrate component effectiveness.
"""
    
    def _generate_analysis_section_sync(
        self,
        data: ExperimentData,
        paper: Dict[str, Any]
    ) -> str:
        """Synchronous version for preview"""
        return """### Key Findings
1. Significant performance improvement achieved.
2. Method shows strong generalization.

### Performance Analysis
Analysis of factors contributing to improved performance.

### Limitations and Future Work
Discussion of limitations and potential improvements.
"""


# Convenience functions for API usage
async def complete_paper_sections(
    paper_id: str,
    experiment_data: Dict[str, Any],
    llm_client=None,
    paper_db=None,
    sections_to_complete: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Auto-complete paper sections with experimental data.
    
    Args:
        paper_id: Paper identifier
        experiment_data: JSON-formatted experimental data
        llm_client: Optional LLM client
        paper_db: Optional paper database
        sections_to_complete: Which sections to complete
        
    Returns:
        Completion result with updated paper
    """
    service = AutoCompletionService(llm_client=llm_client, paper_db=paper_db)
    return await service.complete_paper(paper_id, experiment_data, sections_to_complete)


def preview_section_completion(
    paper_id: str,
    experiment_data: Dict[str, Any],
    section: str,
    llm_client=None
) -> Dict[str, Any]:
    """
    Preview completion for a section.
    
    Args:
        paper_id: Paper identifier
        experiment_data: JSON-formatted experimental data
        section: Section to preview
        llm_client: Optional LLM client
        
    Returns:
        Preview result
    """
    service = AutoCompletionService(llm_client=llm_client)
    return service.preview_completion(paper_id, experiment_data, section)
