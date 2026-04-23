"""
Skill 2: Query Structural Gaps

This skill uses graph algorithms to find structural vulnerabilities in the knowledge graph.
It identifies research opportunities by analyzing topology patterns.

Key Patterns:
1. Isolated Abyss: Problems addressed by papers but lacking methods
2. Bottleneck: High-centrality problems with limited solution diversity
"""

import logging
from typing import List, Dict, Any, Optional
from neo4j import Driver

from ..models.schema import StructuralGap

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QueryStructuralGapsSkill:
    """
    Skill 2: Find structural gaps in the knowledge graph.
    
    This skill acts as the "logical left brain" - using precise graph traversal
    to identify research opportunities that might be missed by human review.
    """
    
    def __init__(self, neo4j_driver: Driver):
        self.neo4j = neo4j_driver
    
    def _find_isolated_abyss(self, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Find problems that are addressed by papers but have no solving methods.
        
        Pattern: (Problem) <-[:ADDRESSES_PROBLEM]- (Paper)
                BUT NO (Method) -[:SOLVES]-> (Problem)
        """
        cypher = """
        MATCH (p:Problem)
        WHERE (p)<-[:ADDRESSES_PROBLEM]-(:Paper)  // Has papers addressing it
        AND NOT (p)<-[:SOLVES]-(:Method)        // But no methods solving it
        """
        
        if domain:
            cypher += " AND p.domain = $domain"
        
        cypher += """
        WITH p, COUNT { (p)<-[:ADDRESSES_PROBLEM]-(:Paper) } as paper_count
        RETURN p.id as problem_id,
               p.name as problem_name,
               p.domain as domain,
               paper_count,
               "isolated_abyss" as gap_type,
               "Problem addressed by " + paper_count + " papers but no solving methods found" as description
        ORDER BY paper_count DESC
        LIMIT 10
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"domain": domain} if domain else {})
            return [record.data() for record in result]
    
    def _find_bottlenecks(self, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Find high-centrality problems with limited solution diversity.
        
        Pattern: Problems that are prerequisites for many other problems
                 but have few or old methods
        """
        cypher = """
        MATCH (p:Problem)
        OPTIONAL MATCH (p)<-[:SUB_PROBLEM_OF]-(child:Problem)
        WITH p, COUNT(child) as child_count
        WHERE child_count >= 2  // Is a parent to multiple problems
        
        OPTIONAL MATCH (p)<-[:SOLVES]-(m:Method)
        WITH p, child_count, COUNT(m) as method_count,
             COLLECT(DISTINCT m.year) as method_years
        
        WHERE method_count <= 2  // Few methods available
        """
        
        if domain:
            cypher += " AND p.domain = $domain"
        
        cypher += """
        RETURN p.id as problem_id,
               p.name as problem_name,
               p.domain as domain,
               child_count,
               method_count,
               "bottleneck" as gap_type,
               "High-centrality problem (" + child_count + " sub-problems) with only " + method_count + " methods" as description
        ORDER BY child_count DESC, method_count ASC
        LIMIT 10
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"domain": domain} if domain else {})
            return [record.data() for record in result]
    
    def _find_low_effectiveness_solutions(self, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Find problems where existing methods have low effectiveness.
        
        Pattern: SOLVES relationships with effectiveness containing "low", "moderate", "limited"
        """
        cypher = """
        MATCH (m:Method)-[r:SOLVES]->(p:Problem)
        WHERE r.effectiveness =~ "(?i).*\\b(low|moderate|limited|partial|poor)\\b.*"
        """
        
        if domain:
            cypher += " AND p.domain = $domain"
        
        cypher += """
        WITH p, COUNT(m) as method_count,
             COLLECT({method: m.name, effectiveness: r.effectiveness, limitations: r.limitations}) as attempts
        RETURN p.id as problem_id,
               p.name as problem_name,
               p.domain as domain,
               method_count,
               "low_effectiveness" as gap_type,
               "Problem has " + method_count + " methods but all with limited effectiveness" as description,
               attempts
        ORDER BY method_count DESC
        LIMIT 10
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"domain": domain} if domain else {})
            return [record.data() for record in result]
    
    def execute(self, domain: Optional[str] = None) -> List[StructuralGap]:
        """
        Main entry point for Skill 2.
        
        Returns a list of structural gaps found in the knowledge graph,
        ordered by severity (high-centrality, many papers but no solutions).
        
        Args:
            domain: Optional filter by research domain
            
        Returns:
            List of StructuralGap objects with gap type and description
        """
        logger.info(f"Querying structural gaps{' for domain: ' + domain if domain else ''}")
        
        all_gaps = []
        
        # Query all three gap types
        try:
            isolated = self._find_isolated_abyss(domain)
            all_gaps.extend(isolated)
            logger.info(f"Found {len(isolated)} isolated abyss gaps")
        except Exception as e:
            logger.error(f"Error finding isolated abyss: {e}")
        
        try:
            bottlenecks = self._find_bottlenecks(domain)
            all_gaps.extend(bottlenecks)
            logger.info(f"Found {len(bottlenecks)} bottleneck gaps")
        except Exception as e:
            logger.error(f"Error finding bottlenecks: {e}")
        
        try:
            low_eff = self._find_low_effectiveness_solutions(domain)
            all_gaps.extend(low_eff)
            logger.info(f"Found {len(low_eff)} low-effectiveness gaps")
        except Exception as e:
            logger.error(f"Error finding low effectiveness: {e}")
        
        # Convert to StructuredGap objects
        gaps = []
        for gap_data in all_gaps:
            gaps.append(StructuralGap(
                gap_type=gap_data.get("gap_type", "unknown"),
                problem_id=gap_data.get("problem_id", ""),
                problem_name=gap_data.get("problem_name", ""),
                description=gap_data.get("description", ""),
                severity_score=self._calculate_severity(gap_data),
                related_papers_count=gap_data.get("paper_count", 0),
                current_methods_count=gap_data.get("method_count", 0)
            ))
        
        # Sort by severity
        gaps.sort(key=lambda x: x.severity_score, reverse=True)
        
        logger.info(f"Total gaps found: {len(gaps)}")
        return gaps
    
    def _calculate_severity(self, gap_data: Dict[str, Any]) -> float:
        """
        Calculate severity score based on gap type and metrics.
        
        Higher score = more severe gap (more critical to address)
        """
        gap_type = gap_data.get("gap_type", "")
        paper_count = gap_data.get("paper_count", 0) or gap_data.get("child_count", 0)
        method_count = gap_data.get("method_count", 0)
        
        if gap_type == "isolated_abyss":
            // Many papers but no methods = high severity
            return min(1.0, 0.5 + (paper_count * 0.1))
        
        elif gap_type == "bottleneck":
            // High centrality with few methods = high severity
            centrality_factor = min(0.6, paper_count * 0.1)
            method_factor = max(0.0, 0.4 - (method_count * 0.15))
            return centrality_factor + method_factor
        
        elif gap_type == "low_effectiveness":
            // Methods exist but don't work well = moderate severity
            return min(0.7, 0.3 + (method_count * 0.05))
        
        return 0.5


# Convenience function for direct usage
def query_structural_gaps(
    neo4j_driver: Driver,
    domain: Optional[str] = None
) -> List[StructuralGap]:
    """
    Standalone function for Skill 2.
    
    Usage:
        gaps = query_structural_gaps(driver, domain="Robotics")
        for gap in gaps:
            print(f"{gap.gap_type}: {gap.problem_name} - {gap.description}")
    """
    skill = QueryStructuralGapsSkill(neo4j_driver)
    return skill.execute(domain)
