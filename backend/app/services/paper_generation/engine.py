"""
Paper Generation Engine
Main orchestrator for the paper generation pipeline with full LLM integration
"""

import os
import json
import logging
import uuid
import re
from typing import Dict, Any, List, Optional, AsyncGenerator
from datetime import datetime
from enum import Enum
import sqlite3
import asyncio
from string import Template

logger = logging.getLogger(__name__)


class GenerationStage(Enum):
    """Stages of paper generation"""
    INIT = "init"
    TITLE_GENERATION = "title"
    ABSTRACT_GENERATION = "abstract"
    INTRODUCTION = "introduction"
    METHODOLOGY = "methodology"
    EXPERIMENT_DESIGN = "experiment_design"
    ANALYSIS_FRAMEWORK = "analysis"
    CONCLUSION = "conclusion"
    QUALITY_CHECK = "quality_check"
    COMPLETED = "complete"


class PaperGenerationEngine:
    """
    Main engine for generating academic papers from innovation opportunities.
    
    This engine orchestrates the paper generation process through multiple stages:
    1. Title generation
    2. Abstract generation (PMR format)
    3. Introduction writing
    4. Methodology section
    5. Experiment design
    6. Analysis framework
    7. Conclusion
    8. Quality validation
    
    Each stage can be paused for human intervention (experiment data collection).
    """
    
    def __init__(self, llm_client=None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the paper generation engine.
        
        Args:
            llm_client: LLM client for generation (e.g., Kimi, OpenAI)
            config: Configuration dictionary
        """
        self.db_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "data", "research_graph.db"
        )
        self.llm_client = llm_client
        self.config = config or {}
        self._ensure_db_exists()
        self._load_prompts()
        logger.info("PaperGenerationEngine initialized")
    
    def _ensure_db_exists(self):
        """Ensure database and tables exist"""
        if not os.path.exists(self.db_path):
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            # Run migration if needed
            migrate_script = os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "migrate_paper_generation.py"
            )
            if os.path.exists(migrate_script):
                import subprocess
                subprocess.run(["python3", migrate_script], check=False)
    
    def _load_prompts(self):
        """Load prompt templates from files"""
        prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
        self.prompts = {}
        
        prompt_files = {
            "title_generation": "title_generation.txt",
            "abstract_pmr": "abstract_pmr.txt",
            "introduction": "introduction.txt",
            "methodology": "methodology.txt",
            "experiment_design": "experiment_design.txt",
            "analysis_framework": "analysis_framework.txt",
            "conclusion": "conclusion.txt",
            "related_work": "related_work.txt"
        }
        
        for key, filename in prompt_files.items():
            filepath = os.path.join(prompts_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.prompts[key] = f.read()
            else:
                # Use default placeholder if file doesn't exist
                self.prompts[key] = f"# {key.replace('_', ' ').title()} Prompt\n\n[Template not yet configured]"
                logger.warning(f"Prompt file not found: {filepath}")
    
    async def generate(self, innovation_id: str, target_venue: str = "NeurIPS") -> Dict[str, Any]:
        """
        Main generation flow - generates complete paper from innovation point.
        
        Args:
            innovation_id: ID of the innovation point to generate from
            target_venue: Target conference/journal venue
            
        Returns:
            Complete paper draft with all sections
        """
        logger.info(f"Starting paper generation for innovation {innovation_id}")
        
        # 1. Load innovation data
        innovation = await self._load_innovation_data(innovation_id)
        if not innovation:
            raise ValueError(f"Innovation {innovation_id} not found")
        
        paper_sections = {
            "innovation_id": innovation_id,
            "target_venue": target_venue,
            "created_at": datetime.now().isoformat()
        }
        
        # 2. Generate Title
        logger.info("Stage: Title Generation")
        title = await self.generate_title(innovation, target_venue)
        paper_sections["title"] = title
        
        # 3. Generate Abstract (PMR format)
        logger.info("Stage: Abstract Generation")
        abstract = await self.generate_abstract(innovation, title, target_venue)
        paper_sections["abstract"] = abstract
        
        # 4. Generate Introduction
        logger.info("Stage: Introduction")
        introduction = await self.generate_introduction(innovation, title, abstract)
        paper_sections["introduction"] = introduction
        
        # 5. Generate Methodology
        logger.info("Stage: Methodology")
        methodology = await self.generate_methodology(innovation, paper_sections)
        paper_sections["methodology"] = methodology
        
        # 6. Generate Experiment Design
        logger.info("Stage: Experiment Design")
        experiment_design = await self.generate_experiment_design(innovation, paper_sections)
        paper_sections["experiment_design"] = experiment_design
        
        # 7. Generate Analysis Framework
        logger.info("Stage: Analysis Framework")
        analysis = await self.generate_analysis_framework(innovation, paper_sections)
        paper_sections["analysis"] = analysis
        
        # 8. Generate Conclusion
        logger.info("Stage: Conclusion")
        conclusion = await self.generate_conclusion(paper_sections)
        paper_sections["conclusion"] = conclusion
        
        # 9. Quality validation
        logger.info("Stage: Quality Validation")
        quality_report = await self._validate_paper(paper_sections)
        paper_sections["quality_report"] = quality_report
        
        logger.info("Paper generation completed")
        return paper_sections
    
    async def stream_generate(self, task_id: str, innovation_id: str, target_venue: str = "NeurIPS") -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream generation progress via SSE.
        
        Yields progress updates at each stage.
        """
        stages = [
            ("init", 0),
            ("title", 10),
            ("abstract", 20),
            ("introduction", 35),
            ("methodology", 50),
            ("experiment_design", 65),
            ("analysis", 80),
            ("conclusion", 90),
            ("quality_check", 95),
            ("complete", 100)
        ]
        
        try:
            # Yield initial status
            yield {"stage": "init", "progress": 0, "message": "Starting paper generation..."}
            
            # Load innovation data
            innovation = await self._load_innovation_data(innovation_id)
            if not innovation:
                yield {"stage": "error", "progress": 0, "message": f"Innovation {innovation_id} not found"}
                return
            
            paper_sections = {
                "innovation_id": innovation_id,
                "target_venue": target_venue
            }
            
            # Generate through each stage
            for stage_name, progress in stages[1:-1]:
                yield {"stage": stage_name, "progress": progress, "message": f"Generating {stage_name}..."}
                
                if stage_name == "title":
                    paper_sections["title"] = await self.generate_title(innovation, target_venue)
                elif stage_name == "abstract":
                    paper_sections["abstract"] = await self.generate_abstract(innovation, paper_sections["title"], target_venue)
                elif stage_name == "introduction":
                    paper_sections["introduction"] = await self.generate_introduction(innovation, paper_sections["title"], paper_sections["abstract"])
                elif stage_name == "methodology":
                    paper_sections["methodology"] = await self.generate_methodology(innovation, paper_sections)
                elif stage_name == "experiment_design":
                    paper_sections["experiment_design"] = await self.generate_experiment_design(innovation, paper_sections)
                elif stage_name == "analysis":
                    paper_sections["analysis"] = await self.generate_analysis_framework(innovation, paper_sections)
                elif stage_name == "conclusion":
                    paper_sections["conclusion"] = await self.generate_conclusion(paper_sections)
                elif stage_name == "quality_check":
                    paper_sections["quality_report"] = await self._validate_paper(paper_sections)
                
                # Small delay for SSE flow
                await asyncio.sleep(0.1)
            
            # Final yield with complete paper
            output_path = await self._save_paper(paper_sections, task_id)
            yield {
                "stage": "complete",
                "progress": 100,
                "message": "Paper generation completed successfully",
                "paper_path": output_path,
                "sections": paper_sections
            }
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            yield {"stage": "error", "progress": 0, "message": str(e)}
    
    async def generate_title(self, innovation: Dict, target_venue: str) -> str:
        """Generate paper title using title_generation prompt"""
        prompt_template = self.prompts.get("title_generation", "")
        
        # Prepare variables
        variables = {
            "problem": innovation.get("targetProblem", {}).get("name", "Unknown Problem"),
            "method": innovation.get("proposedMethod", {}).get("name", "Novel Approach"),
            "target_venue": target_venue,
            "domain": innovation.get("type", "cross_domain").replace("_", " ").title()
        }
        
        prompt = self._fill_template(prompt_template, variables)
        
        # Call LLM
        response = await self._call_llm(prompt, temperature=0.7)
        
        # Extract best title option
        return self._extract_best_title(response)
    
    async def generate_abstract(self, innovation: Dict, title: str, target_venue: str) -> Dict[str, Any]:
        """Generate PMR structure abstract"""
        prompt_template = self.prompts.get("abstract_pmr", "")
        
        variables = {
            "title": title,
            "problem": innovation.get("targetProblem", {}).get("description", ""),
            "method": innovation.get("proposedMethod", {}).get("description", ""),
            "expected_outcomes": innovation.get("expectedImpact", ""),
            "target_venue": target_venue
        }
        
        prompt = self._fill_template(prompt_template, variables)
        response = await self._call_llm(prompt, temperature=0.5)
        
        # Parse PMR structure
        return {
            "full_text": response.strip(),
            "problem": self._extract_section(response, "Problem"),
            "method": self._extract_section(response, "Method"),
            "result": self._extract_section(response, "Result"),
            "word_count": len(response.split())
        }
    
    async def generate_introduction(self, innovation: Dict, title: str, abstract: Dict) -> str:
        """
        Generate introduction section.
        
        Includes:
        - Problem background and motivation
        - Existing method limitations
        - Paper contributions
        - Paper structure
        """
        prompt_template = self.prompts.get("introduction", "")
        
        # Get related papers from innovation
        related_papers = innovation.get("sourcePapers", [])
        related_work_summary = self._format_related_work(related_papers)
        
        variables = {
            "title": title,
            "abstract": abstract.get("full_text", ""),
            "problem_domain": innovation.get("targetProblem", {}).get("name", ""),
            "contributions": innovation.get("expectedImpact", ""),
            "related_work": related_work_summary
        }
        
        prompt = self._fill_template(prompt_template, variables)
        return await self._call_llm(prompt, temperature=0.6)
    
    async def generate_methodology(self, innovation: Dict, paper_sections: Dict) -> str:
        """
        Generate methodology section.
        
        Includes:
        - Method overview
        - Key technical details
        - Comparison with existing methods
        """
        prompt_template = self.prompts.get("methodology", "")
        
        method = innovation.get("proposedMethod", {})
        
        variables = {
            "title": paper_sections.get("title", ""),
            "abstract": paper_sections.get("abstract", {}).get("full_text", ""),
            "components": json.dumps(method.get("components", [])),
            "architecture": method.get("architecture", "Not specified"),
            "notation": method.get("notation", "Standard notation"),
            "venue": paper_sections.get("target_venue", "NeurIPS")
        }
        
        prompt = self._fill_template(prompt_template, variables)
        return await self._call_llm(prompt, temperature=0.5)
    
    async def generate_experiment_design(self, innovation: Dict, paper_sections: Dict) -> Dict[str, Any]:
        """
        Generate experiment design with placeholder slots.
        
        Returns dict with:
        - design_text: Full experiment design text
        - slots: List of data collection slots
        """
        prompt_template = self.prompts.get("experiment_design", "")
        
        method = innovation.get("proposedMethod", {})
        problem = innovation.get("targetProblem", {})
        
        variables = {
            "method": method.get("name", ""),
            "research_questions": json.dumps(problem.get("questions", [])),
            "resources": "Standard compute resources (GPU cluster)",
            "baselines": "State-of-the-art methods in the field",
            "metrics": "Standard evaluation metrics for the domain",
            "budget": "Reasonable computational budget for conference deadline"
        }
        
        prompt = self._fill_template(prompt_template, variables)
        design_text = await self._call_llm(prompt, temperature=0.5)
        
        # Generate structured slots
        slots = self._generate_experiment_slots(innovation)
        
        return {
            "design_text": design_text,
            "slots": slots
        }
    
    async def generate_analysis_framework(self, innovation: Dict, paper_sections: Dict) -> str:
        """
        Generate analysis framework section.
        
        Includes:
        - Evaluation metrics
        - Baseline comparison methods
        - Statistical analysis methods
        - Expected results interpretation framework
        """
        prompt_template = self.prompts.get("analysis_framework", "")
        
        variables = {
            "results": "[Experiment results to be inserted]",
            "questions": json.dumps(innovation.get("targetProblem", {}).get("questions", [])),
            "method": paper_sections.get("title", ""),
            "comparisons": "State-of-the-art baselines"
        }
        
        prompt = self._fill_template(prompt_template, variables)
        return await self._call_llm(prompt, temperature=0.5)
    
    async def generate_conclusion(self, paper_sections: Dict) -> str:
        """Generate conclusion summarizing contributions and future work"""
        prompt_template = self.prompts.get("conclusion", "")
        
        # Build prompt from existing sections
        sections_text = f"""
Title: {paper_sections.get('title', '')}

Abstract: {paper_sections.get('abstract', {}).get('full_text', '')}

Key Contributions:
- {paper_sections.get('methodology', '')[:200]}...
- {paper_sections.get('experiment_design', {}).get('design_text', '')[:200]}...
"""
        
        # Use a generic conclusion prompt if template not available
        if not prompt_template or prompt_template == "[Template not yet configured]":
            return self._generate_generic_conclusion(paper_sections)
        
        variables = {
            "sections": sections_text
        }
        
        prompt = self._fill_template(prompt_template, variables)
        return await self._call_llm(prompt, temperature=0.6)
    
    async def _load_innovation_data(self, innovation_id: str) -> Optional[Dict]:
        """Load innovation data from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Try to load from a hypothetical innovation table
            # In real implementation, this would query the actual innovation storage
            cursor.execute("""
                SELECT * FROM innovation_opportunities 
                WHERE id = ?
            """, (innovation_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            
            # Fallback: return mock data for testing
            return self._get_mock_innovation(innovation_id)
            
        except Exception as e:
            logger.warning(f"Failed to load innovation from DB: {e}")
            return self._get_mock_innovation(innovation_id)
    
    async def _call_llm(self, prompt: str, temperature: float = 0.5) -> str:
        """Call LLM client to generate text"""
        if not self.llm_client:
            # Return mock response for testing
            return f"[Mock LLM Response for prompt length {len(prompt)}]"
        
        try:
            # Use the LLM client (e.g., Kimi via Anthropic SDK)
            response = await self.llm_client.messages.create(
                model=getattr(self.llm_client, 'model', 'kimi-for-coding'),
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=4096
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return f"[Error: {str(e)}]"
    
    async def _validate_paper(self, paper_sections: Dict) -> Dict[str, Any]:
        """Run quality validation on generated paper"""
        from .validators.quality_checker import QualityChecker
        from .validators.completeness_checker import CompletenessChecker
        
        venue = paper_sections.get("target_venue", "NeurIPS")
        
        # Run quality check
        qc = QualityChecker(venue)
        paper_text = self._assemble_paper_text(paper_sections)
        quality_report = qc.check_paper(paper_text, paper_sections)
        
        # Run completeness check
        cc = CompletenessChecker()
        completeness_report = cc.check_completeness(paper_sections)
        
        return {
            "quality": quality_report,
            "completeness": completeness_report,
            "passed": quality_report["passes_minimum"] and completeness_report["is_complete"]
        }
    
    async def _save_paper(self, paper_sections: Dict, task_id: str) -> str:
        """Save complete paper to file"""
        output_dir = os.path.join(os.path.dirname(self.db_path), "papers")
        os.makedirs(output_dir, exist_ok=True)
        
        # Assemble paper
        paper_text = self._assemble_paper_text(paper_sections)
        
        # Save to file
        paper_path = os.path.join(output_dir, f"{task_id}.md")
        with open(paper_path, 'w', encoding='utf-8') as f:
            f.write(paper_text)
        
        return paper_path
    
    def _assemble_paper_text(self, paper_sections: Dict) -> str:
        """Assemble all sections into complete paper text"""
        sections = [
            f"# {paper_sections.get('title', 'Untitled Paper')}",
            "",
            "**Authors:** [To be filled]",
            "",
            "## Abstract",
            paper_sections.get('abstract', {}).get('full_text', '[Abstract pending]'),
            "",
            "## 1. Introduction",
            paper_sections.get('introduction', '[Introduction pending]'),
            "",
            "## 2. Related Work",
            "[Related work section to be generated from source papers]",
            "",
            "## 3. Methodology",
            paper_sections.get('methodology', '[Methodology pending]'),
            "",
            "## 4. Experimental Setup",
        ]
        
        # Add experiment design
        exp_design = paper_sections.get('experiment_design', {})
        sections.append(exp_design.get('design_text', '[Experiment design pending]'))
        
        # Add experiment slots
        slots = exp_design.get('slots', [])
        if slots:
            sections.append("\n### Experiment Data Collection Slots\n")
            for slot in slots:
                sections.append(f"**{slot.get('slot_id', 'N/A')}**: {slot.get('placeholder', '')}")
        
        sections.extend([
            "",
            "## 5. Results and Analysis",
            paper_sections.get('analysis', '[Analysis pending]'),
            "",
            "## 6. Conclusion",
            paper_sections.get('conclusion', '[Conclusion pending]'),
            "",
            "## References",
            "[References to be added]",
            "",
            "---",
            f"\n*Generated by Research Nexus Pro - {datetime.now().strftime('%Y-%m-%d')}*"
        ])
        
        return "\n".join(sections)
    
    def _fill_template(self, template: str, variables: Dict[str, str]) -> str:
        """Fill template variables"""
        try:
            t = Template(template)
            return t.safe_substitute(variables)
        except Exception as e:
            logger.warning(f"Template filling failed: {e}")
            # Simple fallback
            result = template
            for key, value in variables.items():
                result = result.replace(f"{{{{{key}}}}}", str(value))
            return result
    
    def _extract_best_title(self, response: str) -> str:
        """Extract the best title option from LLM response"""
        lines = response.split('\n')
        for line in lines:
            line = line.strip()
            # Look for "Option 1" line or the first substantial line
            if line and not line.startswith('#') and not line.startswith('Option'):
                if len(line) > 20 and len(line) < 200:
                    return line
        return "Novel Approach for Research Problem: A Systematic Study"
    
    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract a section from text"""
        patterns = [
            rf'##?\s*{section_name}[\s:]*(.*?)(?=##?\s|$)',
            rf'{section_name}:\s*(.*?)(?=\n\w|$)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        return ""
    
    def _format_related_work(self, papers: List[Dict]) -> str:
        """Format related papers for prompt"""
        if not papers:
            return "No specific source papers listed."
        
        summaries = []
        for paper in papers[:5]:  # Limit to 5 papers
            title = paper.get('title', 'Unknown')
            year = paper.get('year', 'N/A')
            summaries.append(f"- {title} ({year})")
        
        return "\n".join(summaries)
    
    def _generate_experiment_slots(self, innovation: Dict) -> List[Dict]:
        """Generate experiment data collection slots"""
        slots = [
            {
                "slot_id": "exp_1",
                "type": "main_performance",
                "description": "Collect baseline performance metrics and main results",
                "expected_outcome": "Table with mean ± std across multiple runs",
                "placeholder": "[PENDING:实验1-主性能评估-预计2周-需要收集: 多轮运行结果、对比基线数据]",
                "estimated_weeks": 2
            },
            {
                "slot_id": "exp_2",
                "type": "ablation_study",
                "description": "Ablation study to validate each component's contribution",
                "expected_outcome": "Bar chart + table showing component importance",
                "placeholder": "[PENDING:实验2-消融研究-预计1周-需要收集: 各组件消融结果]",
                "estimated_weeks": 1
            },
            {
                "slot_id": "exp_3",
                "type": "robustness_analysis",
                "description": "Robustness tests under various conditions",
                "expected_outcome": "Analysis figures and statistical tests",
                "placeholder": "[PENDING:实验3-鲁棒性分析-预计1周-需要收集: 不同条件下的性能数据]",
                "estimated_weeks": 1
            }
        ]
        
        # Adjust based on innovation type
        innovation_type = innovation.get('type', '')
        if innovation_type == 'cross_domain':
            slots.append({
                "slot_id": "exp_4",
                "type": "cross_domain_validation",
                "description": "Validate method across different domains",
                "expected_outcome": "Cross-domain performance comparison",
                "placeholder": "[PENDING:实验4-跨域验证-预计2周-需要收集: 多领域实验数据]",
                "estimated_weeks": 2
            })
        
        return slots
    
    def _generate_generic_conclusion(self, paper_sections: Dict) -> str:
        """Generate generic conclusion if template not available"""
        title = paper_sections.get('title', 'This work')
        return f"""In this paper, we presented {title}. Our approach addresses key limitations in existing methods and demonstrates significant improvements over state-of-the-art baselines. 

Our main contributions include: (1) a novel methodological framework that enables more effective solutions; (2) comprehensive empirical validation demonstrating strong performance gains; and (3) detailed analysis providing insights into the method's behavior.

Future work will explore several promising directions, including extending the method to broader problem settings, improving computational efficiency, and investigating theoretical properties. We believe this work opens up new possibilities for advancing research in this area."""
    
    def _get_mock_innovation(self, innovation_id: str) -> Dict:
        """Generate mock innovation data for testing"""
        return {
            "id": innovation_id,
            "type": "cross_domain",
            "title": "Cross-Domain Transfer for Tactile Perception",
            "description": "Applying acoustic metamaterial principles to tactile sensor design",
            "sourcePapers": [
                {"title": "High-Frequency Tactile Sensing", "year": 2024},
                {"title": "Acoustic Metamaterials Review", "year": 2023}
            ],
            "targetProblem": {
                "name": "High-Frequency Tactile Signal Capture",
                "description": "Current tactile sensors struggle to capture vibrations above 500Hz, limiting dexterous manipulation capabilities.",
                "questions": ["How to capture high-frequency tactile signals?", "What materials enable broadband sensing?"]
            },
            "proposedMethod": {
                "name": "Metamaterial-Inspired Tactile Sensor",
                "description": "A novel sensor design inspired by acoustic metamaterial principles",
                "components": ["Metamaterial core", "Optical readout", "Signal processing"],
                "architecture": "Layered metamaterial structure with embedded sensing elements"
            },
            "confidenceScore": 0.85,
            "expectedImpact": "Enable next-generation robotic manipulation with human-like tactile sensitivity"
        }


class PaperAssembler:
    """
    Assembles paper sections into complete documents in various formats.
    """
    
    @staticmethod
    def assemble_markdown(sections: Dict[str, Any], experiment_slots: List[Dict]) -> str:
        """Assemble sections into complete Markdown paper"""
        lines = [
            f"# {sections.get('title', 'Untitled Paper')}",
            "",
            "**Authors:** [To be filled]",
            f"**Target Venue:** {sections.get('target_venue', 'NeurIPS')}",
            "",
            "## Abstract",
            sections.get('abstract', {}).get('full_text', '[Abstract pending]'),
            "",
            "## 1. Introduction",
            sections.get('introduction', '[Introduction pending]'),
            "",
            "## 2. Related Work",
            "[Related work section to be expanded]",
            "",
            "## 3. Methodology",
            sections.get('methodology', '[Methodology pending]'),
            "",
            "## 4. Experimental Setup",
            sections.get('experiment_design', {}).get('design_text', '[Experiment design pending]'),
            "",
            "### 4.1 Data Collection Slots",
            "The following experiments require real data collection:",
            ""
        ]
        
        # Add experiment slots
        for slot in experiment_slots:
            lines.extend([
                f"**{slot.get('slot_id')}** ({slot.get('type')}):",
                f"- Description: {slot.get('description')}",
                f"- Expected Outcome: {slot.get('expected_outcome')}",
                f"- Status: {slot.get('placeholder', '[PENDING]')}",
                ""
            ])
        
        lines.extend([
            "## 5. Results and Analysis",
            "[Results pending experiment data collection]",
            sections.get('analysis', '[Analysis framework pending]'),
            "",
            "## 6. Conclusion",
            sections.get('conclusion', '[Conclusion pending]'),
            "",
            "## References",
            "[References to be added]",
            "",
            "---",
            f"\n*Generated by Research Nexus Pro - {datetime.now().strftime('%Y-%m-%d')}*",
            f"*Innovation ID: {sections.get('innovation_id', 'N/A')}*"
        ])
        
        return "\n".join(lines)
    
    @staticmethod
    def assemble_latex(sections: Dict[str, Any], experiment_slots: List[Dict]) -> str:
        """Convert paper to LaTeX format"""
        title = sections.get('title', 'Untitled Paper')
        abstract = sections.get('abstract', {}).get('full_text', '')
        
        latex = f"""\\documentclass[{{9pt}}]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{amsmath,amssymb,amsfonts}}
\\usepackage{{graphicx}}
\\usepackage{{hyperref}}

\\title{{{title}}}
\\author{{[Authors to be filled]}}
\\date{{\\today}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
{abstract}
\\end{{abstract}}

\\section{{Introduction}}
{sections.get('introduction', '[Introduction pending]')}

\\section{{Related Work}}
[Related work section to be expanded]

\\section{{Methodology}}
{sections.get('methodology', '[Methodology pending]')}

\\section{{Experiments}}
{sections.get('experiment_design', {}).get('design_text', '[Experiment design pending]')}

\\subsection{{Data Collection Status}}
The following experiments require real data collection:

\\begin{{itemize}}
"""
        
        for slot in experiment_slots:
            latex += f"\\item \\textbf{{{slot.get('slot_id')}}}: {slot.get('description')} - Status: {slot.get('placeholder', '[PENDING]')}\n"
        
        latex += f"""\\end{{itemize}}

\\section{{Results and Analysis}}
{sections.get('analysis', '[Analysis pending]')}

\\section{{Conclusion}}
{sections.get('conclusion', '[Conclusion pending]')}

\\section*{{References}}
[References to be added]

\\end{{document}}
"""
        
        return latex
    
    @staticmethod
    def to_latex(markdown_content: str) -> str:
        """Convert Markdown content to LaTeX"""
        latex = markdown_content
        
        # Replace Markdown headers
        latex = re.sub(r'^# (.+)$', r'\\section{\1}', latex, flags=re.MULTILINE)
        latex = re.sub(r'^## (.+)$', r'\\subsection{\1}', latex, flags=re.MULTILINE)
        latex = re.sub(r'^### (.+)$', r'\\subsubsection{\1}', latex, flags=re.MULTILINE)
        
        # Replace bold and italic
        latex = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', latex)
        latex = re.sub(r'\*(.+?)\*', r'\\textit{\1}', latex)
        
        # Replace code blocks
        latex = re.sub(r'```[\w]*\n(.+?)```', r'\\begin{verbatim}\1\\end{verbatim}', latex, flags=re.DOTALL)
        latex = re.sub(r'`(.+?)`', r'\\texttt{\1}', latex)
        
        return latex
