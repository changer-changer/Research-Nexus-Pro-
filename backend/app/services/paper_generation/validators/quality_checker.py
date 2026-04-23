"""
Quality Checker for Generated Papers
Validates academic standards and venue requirements
"""

import re
from typing import Dict, Any, List, Tuple


class QualityChecker:
    """
    Validates paper quality against academic standards.
    
    Checks:
    - Length requirements
    - Section completeness
    - Citation quality
    - Writing quality indicators
    - Venue-specific requirements
    """
    
    VENUE_REQUIREMENTS = {
        "NeurIPS": {
            "min_pages": 8,
            "max_pages": 9,
            "abstract_words": (150, 250),
            "requires_reproducibility": True,
            "requires_code": False
        },
        "ICML": {
            "min_pages": 8,
            "max_pages": 9,
            "abstract_words": (150, 250),
            "requires_reproducibility": True,
            "requires_code": True
        },
        "ICLR": {
            "min_pages": 8,
            "max_pages": 9,
            "abstract_words": (150, 250),
            "requires_reproducibility": True,
            "requires_code": True
        },
        "AAAI": {
            "min_pages": 7,
            "max_pages": 8,
            "abstract_words": (150, 250),
            "requires_reproducibility": False,
            "requires_code": False
        },
        "IJCAI": {
            "min_pages": 7,
            "max_pages": 9,
            "abstract_words": (150, 250),
            "requires_reproducibility": False,
            "requires_code": False
        }
    }
    
    def __init__(self, venue: str = "NeurIPS"):
        """
        Initialize quality checker.
        
        Args:
            venue: Target venue for the paper
        """
        self.venue = venue
        self.requirements = self.VENUE_REQUIREMENTS.get(venue, self.VENUE_REQUIREMENTS["NeurIPS"])
        self.issues = []
        self.warnings = []
    
    def check_paper(self, paper_content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run all quality checks on a paper.
        
        Args:
            paper_content: Full paper text
            metadata: Paper metadata (title, abstract, sections, etc.)
            
        Returns:
            Quality report with score and issues
        """
        self.issues = []
        self.warnings = []
        
        # Run all checks
        self._check_abstract(metadata.get("abstract", ""))
        self._check_sections(metadata.get("sections", []))
        self._check_citations(paper_content)
        self._check_writing_quality(paper_content)
        self._check_venue_requirements(paper_content, metadata)
        
        # Calculate score
        score = self._calculate_score()
        
        return {
            "score": score,
            "grade": self._get_grade(score),
            "issues": self.issues,
            "warnings": self.warnings,
            "venue": self.venue,
            "passes_minimum": score >= 60
        }
    
    def _check_abstract(self, abstract):
        """Check abstract quality"""
        # Handle both string and dict abstract
        if isinstance(abstract, dict):
            abstract_text = abstract.get("full_text", "")
        else:
            abstract_text = abstract or ""
        
        if not abstract_text:
            self.issues.append("Missing abstract")
            return
        
        word_count = len(abstract_text.split())
        min_words, max_words = self.requirements["abstract_words"]
        
        if word_count < min_words:
            self.issues.append(f"Abstract too short: {word_count} words (min: {min_words})")
        elif word_count > max_words:
            self.issues.append(f"Abstract too long: {word_count} words (max: {max_words})")
        
        # Check PMR structure indicators
        pmr_indicators = {
            "problem": ["problem", "challenge", "issue", "gap", "however", "but"],
            "method": ["propose", "present", "introduce", "develop", "design"],
            "result": ["achieve", "outperform", "improve", "demonstrate", "show"]
        }
        
        abstract_lower = abstract_text.lower()
        for category, words in pmr_indicators.items():
            if not any(word in abstract_lower for word in words):
                self.warnings.append(f"Abstract may be missing {category} indicators")
    
    def _check_sections(self, sections: List[str]):
        """Check required sections exist"""
        required_sections = ["introduction", "method", "experiment", "conclusion"]
        section_lower = [s.lower() for s in sections]
        
        for required in required_sections:
            if not any(required in s for s in section_lower):
                self.issues.append(f"Missing section: {required.capitalize()}")
        
        # Check section order (if available)
        # This is a simplified check
    
    def _check_citations(self, content: str):
        """Check citation practices"""
        # Count citations
        citation_patterns = [
            r'\[\d+\]',  # [1], [23]
            r'\[\d+,\s*\d+\]',  # [1, 2]
            r'\(\w+\s+et\s+al\.?\)',  # (Smith et al.)
            r'\w+\s+\(\d{4}\)'  # Smith (2024)
        ]
        
        citation_count = 0
        for pattern in citation_patterns:
            citation_count += len(re.findall(pattern, content))
        
        # Check for common issues
        if citation_count < 10:
            self.warnings.append(f"Low citation count ({citation_count}). Consider more related work coverage.")
        
        # Check for uncited claims
        claim_patterns = [
            r"(first|novel|state.of.the.art|sota)",
            r"(outperform|superior|better than)"
        ]
        
        for pattern in claim_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                # This is a simplified check - would need more sophisticated analysis
                pass
    
    def _check_writing_quality(self, content: str):
        """Check writing quality indicators"""
        # Check for weak phrases
        weak_phrases = [
            ("very", "Avoid 'very'. Use stronger adjectives."),
            ("thing", "Avoid vague terms like 'thing'. Be specific."),
            ("stuff", "Avoid informal terms like 'stuff'."),
            ("obviously", "Avoid 'obviously'. If it's obvious, don't state it."),
            ("clearly", "Avoid 'clearly'. Let the results speak for themselves."),
        ]
        
        content_lower = content.lower()
        for phrase, message in weak_phrases:
            count = content_lower.count(phrase)
            if count > 3:
                self.warnings.append(f"Found {count} instances of '{phrase}'. {message}")
        
        # Check sentence length
        sentences = re.split(r'[.!?]+', content)
        long_sentences = [s for s in sentences if len(s.split()) > 40]
        if len(long_sentences) > 5:
            self.warnings.append(f"Found {len(long_sentences)} very long sentences (>40 words). Consider breaking them up.")
    
    def _check_venue_requirements(self, content: str, metadata: Dict):
        """Check venue-specific requirements"""
        # Check reproducibility statement
        if self.requirements["requires_reproducibility"]:
            repro_patterns = [
                r"reproducibility",
                r"code.*available",
                r"implementation.*detail",
                r"supplementary"
            ]
            
            has_repro = any(re.search(p, content, re.IGNORECASE) for p in repro_patterns)
            if not has_repro:
                self.warnings.append(f"{self.venue} requires reproducibility information")
        
        # Check for code availability (if required)
        if self.requirements["requires_code"]:
            code_patterns = [r"github", r"code", r"implementation"]
            has_code = any(re.search(p, content, re.IGNORECASE) for p in code_patterns)
            if not has_code:
                self.warnings.append(f"{self.venue} encourages code release. Consider mentioning code availability.")
    
    def _calculate_score(self) -> int:
        """Calculate overall quality score"""
        score = 100
        
        # Deduct for issues
        score -= len(self.issues) * 10
        score -= len(self.warnings) * 5
        
        # Cap at 0-100
        return max(0, min(100, score))
    
    def _get_grade(self, score: int) -> str:
        """Convert score to letter grade"""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    def get_recommendations(self) -> List[str]:
        """Get improvement recommendations"""
        recommendations = []
        
        if any("abstract" in issue.lower() for issue in self.issues):
            recommendations.append("Revise abstract to follow PMR format (Problem-Method-Result)")
        
        if any("section" in issue.lower() for issue in self.issues):
            recommendations.append("Ensure all required sections are present (Introduction, Method, Experiments, Conclusion)")
        
        if self.warnings:
            recommendations.append("Review writing style: reduce weak phrases and vary sentence structure")
        
        if self.venue in ["ICML", "ICLR"]:
            recommendations.append(f"For {self.venue}, add reproducibility statement and code link")
        
        return recommendations
