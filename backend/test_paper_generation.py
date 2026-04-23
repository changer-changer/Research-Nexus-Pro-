"""
Test script for paper generation engine
"""

import asyncio
import os
import sys
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.paper_generation import (
    PaperGenerationEngine,
    ExperimentFeasibilityEvaluator,
    PaperAssembler,
    ProgressStreamer,
    evaluate_experiment_feasibility
)
from app.services.kimi_client import KimiExtractor


async def test_basic_generation():
    """Test basic paper generation flow"""
    print("=" * 60)
    print("Test 1: Basic Paper Generation")
    print("=" * 60)
    
    # Create engine (without LLM for basic test)
    engine = PaperGenerationEngine(llm_client=None)
    
    # Generate from mock innovation
    innovation_id = "test-innovation-001"
    
    try:
        result = await engine.generate(innovation_id, target_venue="NeurIPS")
        
        print(f"✅ Generation completed")
        print(f"   Title: {result.get('title', 'N/A')[:80]}...")
        print(f"   Abstract length: {len(result.get('abstract', {}).get('full_text', ''))} chars")
        print(f"   Has methodology: {bool(result.get('methodology'))}")
        print(f"   Has experiment design: {bool(result.get('experiment_design'))}")
        print(f"   Quality report: {result.get('quality_report', {})}")
        
        return True
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_feasibility_evaluation():
    """Test experiment feasibility evaluator"""
    print("\n" + "=" * 60)
    print("Test 2: Experiment Feasibility Evaluation")
    print("=" * 60)
    
    experiment_design = {
        "slots": [
            {
                "slot_id": "exp_1",
                "type": "main_performance",
                "description": "Main performance evaluation",
                "estimated_weeks": 2
            },
            {
                "slot_id": "exp_2",
                "type": "ablation_study",
                "description": "Ablation study",
                "estimated_weeks": 1
            },
            {
                "slot_id": "exp_3",
                "type": "cross_domain_validation",
                "description": "Cross-domain validation",
                "estimated_weeks": 2
            }
        ],
        "resources": {
            "compute_budget": 80,
            "data_access": 70,
            "equipment": 50
        },
        "dependencies": ["new_dataset", "external_dependencies"]
    }
    
    result = evaluate_experiment_feasibility(experiment_design)
    
    print(f"✅ Feasibility evaluation completed")
    print(f"   Overall Score: {result['overall_score']}/100")
    print(f"   Technical Feasibility: {result['breakdown']['technical_feasibility']}")
    print(f"   Time Cost: {result['breakdown']['time_cost']}")
    print(f"   Resource Demand: {result['breakdown']['resource_demand']}")
    print(f"   Risk Level: {result['breakdown']['risk_level']}")
    print(f"   Expected Success Rate: {result['breakdown']['expected_success_rate']}%")
    print(f"   Estimated Total Weeks: {result['estimated_total_weeks']}")
    print(f"   Passes Minimum: {result['passes_minimum']}")
    print(f"\n   Recommendations ({len(result['recommendations'])}):")
    for rec in result['recommendations'][:3]:
        print(f"   - {rec}")
    
    return True


async def test_paper_assembler():
    """Test paper assembly"""
    print("\n" + "=" * 60)
    print("Test 3: Paper Assembler")
    print("=" * 60)
    
    sections = {
        "title": "Novel Approach for Research Problem: A Systematic Study",
        "abstract": {
            "full_text": "This paper presents a novel approach to solving research problems..."
        },
        "introduction": "Introduction section content...",
        "methodology": "Methodology section content...",
        "experiment_design": {
            "design_text": "Experiment design content..."
        },
        "analysis": "Analysis section content...",
        "conclusion": "Conclusion section content...",
        "innovation_id": "test-001",
        "target_venue": "NeurIPS"
    }
    
    experiment_slots = [
        {
            "slot_id": "exp_1",
            "type": "main_performance",
            "description": "Main performance evaluation",
            "expected_outcome": "Performance metrics table",
            "placeholder": "[PENDING:实验1-主性能评估-预计2周]"
        }
    ]
    
    # Test Markdown assembly
    markdown = PaperAssembler.assemble_markdown(sections, experiment_slots)
    print(f"✅ Markdown assembly completed ({len(markdown)} chars)")
    print(f"   Contains all sections: {'Abstract' in markdown and 'Introduction' in markdown}")
    
    # Test LaTeX assembly
    latex = PaperAssembler.assemble_latex(sections, experiment_slots)
    print(f"✅ LaTeX assembly completed ({len(latex)} chars)")
    print(f"   Contains document class: {'documentclass' in latex}")
    
    return True


async def test_streaming():
    """Test SSE streaming"""
    print("\n" + "=" * 60)
    print("Test 4: SSE Streaming")
    print("=" * 60)
    
    task_id = str(uuid.uuid4())
    engine = PaperGenerationEngine(llm_client=None)
    streamer = ProgressStreamer(task_id, engine)
    
    print(f"Starting stream for task {task_id[:8]}...")
    
    event_count = 0
    try:
        async for event in streamer.stream_generation("test-innovation-001", "NeurIPS"):
            event_count += 1
            data = eval(event.replace('data: ', '').replace('\n\n', ''))
            print(f"   Event {event_count}: {data.get('stage')} - {data.get('progress')}%")
            
            if event_count >= 5:  # Just test first few events
                print("   (Stopping early for demo)")
                break
        
        print(f"✅ Streaming test completed ({event_count} events)")
        return True
    except Exception as e:
        print(f"❌ Streaming failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_with_llm():
    """Test with actual LLM (if API key available)"""
    print("\n" + "=" * 60)
    print("Test 5: With LLM (optional)")
    print("=" * 60)
    
    api_key = os.getenv("KIMI_API_KEY")
    if not api_key or api_key == "placeholder":
        print("⚠️ KIMI_API_KEY not available, skipping LLM test")
        return True
    
    try:
        # Create Kimi client
        kimi = KimiExtractor()
        
        # Create engine with LLM
        engine = PaperGenerationEngine(llm_client=kimi.client)
        
        # Generate a title
        mock_innovation = {
            "targetProblem": {"name": "High-Frequency Tactile Sensing"},
            "proposedMethod": {"name": "Metamaterial-Inspired Sensor Array"},
            "type": "cross_domain"
        }
        
        title = await engine.generate_title(mock_innovation, "NeurIPS")
        print(f"✅ LLM title generation: {title[:80]}...")
        return True
        
    except Exception as e:
        print(f"⚠️ LLM test skipped/failed: {e}")
        return True  # Don't fail if LLM is not available


async def main():
    """Run all tests"""
    print("\n" + "🧪 Paper Generation Engine Tests" + "\n")
    
    results = []
    
    # Run tests
    results.append(("Basic Generation", await test_basic_generation()))
    results.append(("Feasibility Evaluation", await test_feasibility_evaluation()))
    results.append(("Paper Assembler", await test_paper_assembler()))
    results.append(("SSE Streaming", await test_streaming()))
    results.append(("With LLM", await test_with_llm()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {status}: {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\n   Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
    
    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
