"""
Completeness Checker
Validates that all paper sections are fully populated
"""

from typing import Dict, Any, List


class CompletenessChecker:
    """
    Checks if a paper is complete and ready for submission.
    
    Validates:
    - All sections have content
    - All experiment slots have data
    - Figures/tables are referenced
    - Citations are complete
    - Word/page counts are appropriate
    """
    
    REQUIRED_SECTIONS = [
        "abstract",
        "introduction",
        "related_work",
        "methodology",
        "experiments",
        "conclusion",
        "references"
    ]
    
    MIN_SECTION_WORDS = {
        "abstract": 150,
        "introduction": 400,
        "related_work": 300,
        "methodology": 500,
        "experiments": 400,
        "conclusion": 200
    }
    
    def __init__(self):
        self.missing = []
        self.incomplete = []
        self.complete_sections = []
    
    def check_completeness(self, paper_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if paper is complete.
        
        Args:
            paper_data: Dictionary with paper sections and metadata
            
        Returns:
            Completeness report
        """
        self.missing = []
        self.incomplete = []
        self.complete_sections = []
        
        # Check each required section
        for section in self.REQUIRED_SECTIONS:
            self._check_section(section, paper_data.get(section, {}))
        
        # Check experiment slots
        self._check_experiments(paper_data.get("experiments", []))
        
        # Check citations
        self._check_citations(paper_data)
        
        # Check figures and tables
        self._check_figures_tables(paper_data)
        
        # Calculate completion percentage
        completion_rate = self._calculate_completion_rate()
        
        return {
            "is_complete": completion_rate == 100,
            "completion_rate": completion_rate,
            "missing_sections": self.missing,
            "incomplete_sections": self.incomplete,
            "complete_sections": self.complete_sections,
            "ready_for_review": completion_rate >= 80
        }
    
    def _check_section(self, section_name: str, section_data: Any):
        """Check if a section is present and complete"""
        if not section_data:
            self.missing.append(section_name)
            return
        
        # Handle different section data types
        if isinstance(section_data, str):
            content = section_data
        elif isinstance(section_data, dict):
            content = section_data.get("content", "")
        else:
            content = str(section_data)
        
        # Check word count
        word_count = len(content.split())
        min_words = self.MIN_SECTION_WORDS.get(section_name, 100)
        
        if word_count < min_words:
            self.incomplete.append({
                "section": section_name,
                "issue": f"Too short ({word_count} words, min: {min_words})",
                "word_count": word_count
            })
        elif word_count < min_words * 0.8:
            self.incomplete.append({
                "section": section_name,
                "issue": f"Significantly under length ({word_count} words, target: {min_words})",
                "word_count": word_count
            })
        else:
            self.complete_sections.append({
                "section": section_name,
                "word_count": word_count,
                "status": "complete"
            })
    
    def _check_experiments(self, experiments: List[Dict]):
        """Check if all experiment slots have data"""
        if not experiments:
            self.missing.append("experiments (no slots defined)")
            return
        
        pending = [e for e in experiments if e.get("status") != "completed"]
        
        if pending:
            self.incomplete.append({
                "section": "experiments",
                "issue": f"{len(pending)} experiment slots pending data",
                "pending_slots": [e.get("id") for e in pending]
            })
    
    def _check_citations(self, paper_data: Dict):
        """Check citation completeness"""
        references = paper_data.get("references", [])
        
        if not references:
            self.incomplete.append({
                "section": "references",
                "issue": "No references listed"
            })
        elif len(references) < 15:
            self.incomplete.append({
                "section": "references",
                "issue": f"Low reference count ({len(references)}). Aim for 20-40 references."
            })
    
    def _check_figures_tables(self, paper_data: Dict):
        """Check if figures and tables are present"""
        figures = paper_data.get("figures", [])
        tables = paper_data.get("tables", [])
        
        # Check experiments section for figure/table requirements
        experiments = paper_data.get("experiments", {})
        if isinstance(experiments, dict):
            has_results = experiments.get("has_results", False)
            
            if has_results and not figures and not tables:
                self.incomplete.append({
                    "section": "experiments",
                    "issue": "Experiments have results but no figures or tables"
                })
    
    def _calculate_completion_rate(self) -> int:
        """Calculate percentage of completion"""
        total_sections = len(self.REQUIRED_SECTIONS)
        
        # Count partial credit for incomplete sections
        partial = len(self.incomplete) * 0.5
        
        complete = total_sections - len(self.missing) - partial
        
        return int((complete / total_sections) * 100)
    
    def get_next_steps(self) -> List[str]:
        """Get list of next steps to complete the paper"""
        steps = []
        
        # Priority 1: Missing sections
        if self.missing:
            steps.append(f"Write missing sections: {', '.join(self.missing)}")
        
        # Priority 2: Incomplete sections
        for item in self.incomplete:
            section = item.get("section", "unknown")
            issue = item.get("issue", "needs work")
            steps.append(f"Complete {section}: {issue}")
        
        # Priority 3: General improvements
        if not any(s.get("section") == "figures" for s in self.complete_sections):
            steps.append("Add figures to illustrate key results")
        
        if not any(s.get("section") == "references" for s in self.complete_sections):
            steps.append("Add comprehensive references")
        
        return steps
    
    def get_estimated_completion_time(self) -> str:
        """Estimate hours needed to complete"""
        hours = 0
        
        hours += len(self.missing) * 2  # 2 hours per missing section
        hours += len(self.incomplete) * 1  # 1 hour per incomplete section
        
        if hours == 0:
            return "0 hours - Paper is complete!"
        elif hours <= 4:
            return f"~{hours} hours - Can be completed in one focused session"
        elif hours <= 8:
            return f"~{hours} hours - Requires a full day of work"
        else:
            return f"~{hours} hours - Significant work remaining"
