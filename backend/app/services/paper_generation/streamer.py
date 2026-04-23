"""
SSE Progress Streamer
Handles Server-Sent Events for paper generation progress
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class StreamEventType(Enum):
    """Types of stream events"""
    START = "start"
    PROGRESS = "progress"
    STAGE_COMPLETE = "stage_complete"
    WARNING = "warning"
    ERROR = "error"
    COMPLETE = "complete"


class ProgressStreamer:
    """
    Manages SSE streaming for paper generation progress.
    
    Provides real-time updates on generation status:
    - Stage transitions
    - Progress percentages
    - Generated content previews
    - Error handling
    
    Format: {"stage": "...", "progress": 0-100, "content": "...", "message": "..."}
    """
    
    # Stage progress mapping
    STAGE_PROGRESS = {
        "init": 0,
        "title": 10,
        "abstract": 20,
        "introduction": 35,
        "methodology": 50,
        "experiment_design": 65,
        "analysis": 80,
        "conclusion": 90,
        "quality_check": 95,
        "complete": 100
    }
    
    def __init__(self, task_id: str, engine=None):
        """
        Initialize progress streamer.
        
        Args:
            task_id: Unique task identifier
            engine: PaperGenerationEngine instance
        """
        self.task_id = task_id
        self.engine = engine
        self.current_stage = "init"
        self.progress = 0
        self.started_at = datetime.now()
        self.completed_stages = []
        self.errors = []
        self.warnings = []
        
    async def stream_generation(
        self,
        innovation_id: str,
        target_venue: str = "NeurIPS",
        on_stage_complete: Optional[Callable] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream paper generation progress via SSE.

        Yields JSON-formatted SSE events:
        - data: {"stage": "...", "progress": N, "content": "..."}

        Args:
            innovation_id: Innovation point ID
            target_venue: Target conference venue
            on_stage_complete: Optional callback when stage completes

        Yields:
            SSE-formatted strings
        """
        try:
            # Initial event
            yield self._format_event(StreamEventType.START, {
                "stage": "init",
                "progress": 0,
                "message": "Starting paper generation...",
                "task_id": self.task_id,
                "innovation_id": innovation_id,
                "target_venue": target_venue
            })
            
            if not self.engine:
                yield self._format_event(StreamEventType.ERROR, {
                    "message": "Engine not initialized",
                    "stage": "init",
                    "progress": 0
                })
                return
            
            # Load innovation data
            yield self._format_event(StreamEventType.PROGRESS, {
                "stage": "init",
                "progress": 5,
                "message": "Loading innovation data..."
            })
            
            innovation = await self.engine._load_innovation_data(innovation_id)
            if not innovation:
                yield self._format_event(StreamEventType.ERROR, {
                    "message": f"Innovation {innovation_id} not found",
                    "stage": "init",
                    "progress": 0
                })
                return
            
            paper_sections = {
                "innovation_id": innovation_id,
                "target_venue": target_venue
            }
            
            # Define generation stages
            stages = [
                ("title", self._generate_title_stage, [innovation, target_venue]),
                ("abstract", self._generate_abstract_stage, [innovation, paper_sections]),
                ("introduction", self._generate_introduction_stage, [innovation, paper_sections]),
                ("methodology", self._generate_methodology_stage, [innovation, paper_sections]),
                ("experiment_design", self._generate_experiment_design_stage, [innovation, paper_sections]),
                ("analysis", self._generate_analysis_stage, [innovation, paper_sections]),
                ("conclusion", self._generate_conclusion_stage, [paper_sections]),
                ("quality_check", self._quality_check_stage, [paper_sections]),
            ]
            
            # Process each stage
            for stage_name, stage_func, args in stages:
                try:
                    # Announce stage start
                    yield self._format_event(StreamEventType.PROGRESS, {
                        "stage": stage_name,
                        "progress": self.STAGE_PROGRESS.get(stage_name, 0),
                        "message": f"Generating {stage_name.replace('_', ' ')}..."
                    })
                    
                    # Execute stage
                    result = await stage_func(*args)
                    
                    if result.get("error"):
                        yield self._format_event(StreamEventType.ERROR, {
                            "stage": stage_name,
                            "progress": self.STAGE_PROGRESS.get(stage_name, 0),
                            "message": result["error"]
                        })
                        return
                    
                    # Update paper sections
                    if stage_name == "title":
                        paper_sections["title"] = result["content"]
                    elif stage_name == "abstract":
                        paper_sections["abstract"] = result["content"]
                    elif stage_name == "introduction":
                        paper_sections["introduction"] = result["content"]
                    elif stage_name == "methodology":
                        paper_sections["methodology"] = result["content"]
                    elif stage_name == "experiment_design":
                        paper_sections["experiment_design"] = result["content"]
                    elif stage_name == "analysis":
                        paper_sections["analysis"] = result["content"]
                    elif stage_name == "conclusion":
                        paper_sections["conclusion"] = result["content"]
                    elif stage_name == "quality_check":
                        paper_sections["quality_report"] = result["content"]
                    
                    # Announce stage complete
                    self.completed_stages.append(stage_name)
                    
                    preview = self._generate_preview(result["content"], stage_name)
                    yield self._format_event(StreamEventType.STAGE_COMPLETE, {
                        "stage": stage_name,
                        "progress": self.STAGE_PROGRESS.get(stage_name, 0),
                        "message": f"Completed {stage_name.replace('_', ' ')}",
                        "preview": preview
                    })
                    
                    # Call callback if provided
                    if on_stage_complete:
                        try:
                            on_stage_complete(stage_name, result)
                        except Exception as cb_error:
                            logger.warning(f"Stage callback error: {cb_error}")
                    
                    # Small delay for SSE flow
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Stage {stage_name} failed: {e}")
                    yield self._format_event(StreamEventType.ERROR, {
                        "stage": stage_name,
                        "progress": self.STAGE_PROGRESS.get(stage_name, 0),
                        "message": f"Stage failed: {str(e)}"
                    })
                    return
            
            # Save final paper
            try:
                output_path = await self.engine._save_paper(paper_sections, self.task_id)
                paper_sections["output_path"] = output_path
            except Exception as e:
                logger.warning(f"Failed to save paper: {e}")
                output_path = None
            
            # Final completion event
            elapsed = (datetime.now() - self.started_at).total_seconds()
            yield self._format_event(StreamEventType.COMPLETE, {
                "stage": "complete",
                "progress": 100,
                "message": "Paper generation completed successfully",
                "task_id": self.task_id,
                "paper_path": output_path,
                "elapsed_seconds": elapsed,
                "completed_stages": self.completed_stages,
                "warnings": self.warnings,
                "sections": {
                    "title": paper_sections.get("title", "")[:100] + "..." if len(paper_sections.get("title", "")) > 100 else paper_sections.get("title", ""),
                    "has_abstract": bool(paper_sections.get("abstract")),
                    "has_methodology": bool(paper_sections.get("methodology")),
                    "has_experiments": bool(paper_sections.get("experiment_design")),
                }
            })
            
        except Exception as e:
            logger.error(f"Stream generation failed: {e}")
            yield self._format_event(StreamEventType.ERROR, {
                "stage": "unknown",
                "progress": 0,
                "message": f"Generation failed: {str(e)}"
            })
    
    # Stage generation methods
    
    async def _generate_title_stage(self, innovation: Dict, target_venue: str) -> Dict:
        """Generate title stage"""
        try:
            title = await self.engine.generate_title(innovation, target_venue)
            return {"content": title}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_abstract_stage(self, innovation: Dict, paper_sections: Dict) -> Dict:
        """Generate abstract stage"""
        try:
            abstract = await self.engine.generate_abstract(
                innovation, 
                paper_sections.get("title", ""), 
                paper_sections.get("target_venue", "NeurIPS")
            )
            return {"content": abstract}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_introduction_stage(self, innovation: Dict, paper_sections: Dict) -> Dict:
        """Generate introduction stage"""
        try:
            introduction = await self.engine.generate_introduction(
                innovation,
                paper_sections.get("title", ""),
                paper_sections.get("abstract", {})
            )
            return {"content": introduction}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_methodology_stage(self, innovation: Dict, paper_sections: Dict) -> Dict:
        """Generate methodology stage"""
        try:
            methodology = await self.engine.generate_methodology(innovation, paper_sections)
            return {"content": methodology}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_experiment_design_stage(self, innovation: Dict, paper_sections: Dict) -> Dict:
        """Generate experiment design stage"""
        try:
            exp_design = await self.engine.generate_experiment_design(innovation, paper_sections)
            return {"content": exp_design}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_analysis_stage(self, innovation: Dict, paper_sections: Dict) -> Dict:
        """Generate analysis stage"""
        try:
            analysis = await self.engine.generate_analysis_framework(innovation, paper_sections)
            return {"content": analysis}
        except Exception as e:
            return {"error": str(e)}
    
    async def _generate_conclusion_stage(self, paper_sections: Dict) -> Dict:
        """Generate conclusion stage"""
        try:
            conclusion = await self.engine.generate_conclusion(paper_sections)
            return {"content": conclusion}
        except Exception as e:
            return {"error": str(e)}
    
    async def _quality_check_stage(self, paper_sections: Dict) -> Dict:
        """Run quality check stage"""
        try:
            quality_report = await self.engine._validate_paper(paper_sections)
            return {"content": quality_report}
        except Exception as e:
            return {"error": str(e)}
    
    def _format_event(self, event_type: StreamEventType, data: Dict) -> str:
        """Format event as SSE message"""
        event_data = {
            "type": event_type.value,
            "timestamp": datetime.now().isoformat(),
            "task_id": self.task_id,
            **data
        }
        return f"data: {json.dumps(event_data)}\n\n"
    
    def _generate_preview(self, content: Any, stage_name: str) -> str:
        """Generate a preview of generated content"""
        if isinstance(content, str):
            text = content
        elif isinstance(content, dict):
            if "full_text" in content:
                text = content["full_text"]
            elif "design_text" in content:
                text = content["design_text"]
            else:
                text = str(content)
        else:
            text = str(content)
        
        # Truncate to reasonable preview length
        max_len = 200
        if len(text) > max_len:
            return text[:max_len] + "..."
        return text


class BatchProgressStreamer:
    """
    Manages progress streaming for multiple paper generation tasks.
    """
    
    def __init__(self):
        self.active_streams = {}
        self.completed_streams = {}
    
    def create_stream(self, task_id: str, engine) -> ProgressStreamer:
        """Create a new progress streamer"""
        streamer = ProgressStreamer(task_id, engine)
        self.active_streams[task_id] = streamer
        return streamer
    
    def get_stream(self, task_id: str) -> Optional[ProgressStreamer]:
        """Get an existing streamer"""
        return self.active_streams.get(task_id)
    
    def mark_complete(self, task_id: str):
        """Mark a stream as complete"""
        if task_id in self.active_streams:
            self.completed_streams[task_id] = self.active_streams[task_id]
            del self.active_streams[task_id]
    
    def get_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a stream"""
        streamer = self.active_streams.get(task_id) or self.completed_streams.get(task_id)
        if not streamer:
            return None
        
        return {
            "task_id": task_id,
            "current_stage": streamer.current_stage,
            "progress": streamer.progress,
            "completed_stages": streamer.completed_stages,
            "warnings": streamer.warnings,
            "errors": streamer.errors,
            "is_complete": task_id in self.completed_streams
        }
    
    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all streams"""
        all_status = {}
        for task_id in list(self.active_streams.keys()):
            all_status[task_id] = self.get_status(task_id)
        for task_id in list(self.completed_streams.keys()):
            all_status[task_id] = self.get_status(task_id)
        return all_status


# Convenience function for direct usage
async def stream_generation(
    task_id: str,
    innovation_id: str,
    target_venue: str = "NeurIPS",
    engine=None
) -> AsyncGenerator[str, None]:
    """
    Convenience function to stream paper generation.
    
    Args:
        task_id: Task identifier
        innovation_id: Innovation point ID
        target_venue: Target conference venue
        engine: PaperGenerationEngine instance
        
    Yields:
        SSE-formatted strings
    """
    streamer = ProgressStreamer(task_id, engine)
    async for event in streamer.stream_generation(innovation_id, target_venue):
        yield event
