import React, { useMemo, useRef, useEffect } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';

export interface FlowingEdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  isHighlighted?: boolean;
  isDashed?: boolean;
  animated?: boolean;
  particleCount?: number;
  particleSpeed?: number;
  glowIntensity?: number;
  curvature?: number;
  type?: 'bezier' | 'straight' | 'step';
}

interface Particle {
  id: number;
  progress: number;
  speed: number;
  size: number;
  opacity: number;
}

export const FlowingEdge: React.FC<FlowingEdgeProps> = ({
  x1,
  y1,
  x2,
  y2,
  color = '#6366f1',
  width = 2,
  isHighlighted = false,
  isDashed = false,
  animated = true,
  particleCount = 4,
  particleSpeed = 1,
  glowIntensity = 0.6,
  curvature = 0.2,
  type = 'bezier',
}) => {
  const particlesRef = useRef<Particle[]>([]);
  
  // Initialize particles
  useEffect(() => {
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      progress: i / particleCount,
      speed: (0.3 + Math.random() * 0.4) * particleSpeed,
      size: 2 + Math.random() * 2,
      opacity: 0.6 + Math.random() * 0.4,
    }));
  }, [particleCount, particleSpeed]);

  // Calculate path based on type
  const path = useMemo(() => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    switch (type) {
      case 'straight':
        return `M ${x1} ${y1} L ${x2} ${y2}`;
        
      case 'step':
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        
      case 'bezier':
      default: {
        const midX = (x1 + x2) / 2;
        const curveAmount = distance * curvature;
        // Control points for smooth S-curve
        const cp1x = midX;
        const cp1y = y1 - curveAmount;
        const cp2x = midX;
        const cp2y = y2 + curveAmount;
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      }
    }
  }, [x1, y1, x2, y2, type, curvature]);

  // Calculate control points for particle animation
  const getPointAtProgress = (progress: number) => {
    // For bezier curves, use De Casteljau's algorithm
    const t = progress;
    const dx = x2 - x1;
    const distance = Math.sqrt(dx * dx + (y2 - y1) * (y2 - y1));
    const curveAmount = distance * curvature;
    
    const midX = (x1 + x2) / 2;
    const p0 = { x: x1, y: y1 };
    const p1 = { x: midX, y: y1 - curveAmount };
    const p2 = { x: midX, y: y2 + curveAmount };
    const p3 = { x: x2, y: y2 };
    
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  };

  // Animate particles
  useAnimationFrame(() => {
    if (!animated) return;
    particlesRef.current = particlesRef.current.map(p => ({
      ...p,
      progress: (p.progress + p.speed * 0.01) % 1,
    }));
  });

  const effectiveGlow = isHighlighted ? 1 : glowIntensity;
  const effectiveWidth = isHighlighted ? width * 1.5 : width;
  
  // Unique IDs for gradients and filters
  const uniqueId = useMemo(() => `${x1}-${y1}-${x2}-${y2}`, [x1, y1, x2, y2]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: isHighlighted ? 20 : 1,
      }}
    >
      <defs>
        {/* Main gradient */}
        <linearGradient id={`grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.2 * effectiveGlow} />
          <stop offset="50%" stopColor={color} stopOpacity={0.9 * effectiveGlow} />
          <stop offset="100%" stopColor={color} stopOpacity={0.2 * effectiveGlow} />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isHighlighted ? 5 : 3} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        
        {/* Particle glow */}
        <filter id={`particle-glow-${uniqueId}`}>
          <feGaussianBlur stdDeviation={2} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Arrow marker */}
        <marker
          id={`arrow-${uniqueId}`}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity={0.8} />
        </marker>
      </defs>

      {/* Background glow path (subtle) */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={effectiveWidth * 4}
        strokeOpacity={0.05 * effectiveGlow}
        filter={`url(#glow-${uniqueId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main path */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={effectiveWidth}
        strokeOpacity={0.3 * effectiveGlow}
        strokeDasharray={isDashed ? `${effectiveWidth * 3},${effectiveWidth * 2}` : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: isHighlighted ? `drop-shadow(0 0 ${effectiveWidth * 2}px ${color})` : undefined,
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ 
          pathLength: 1, 
          opacity: 1,
        }}
        transition={{ 
          pathLength: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.3 },
        }}
      />

      {/* Animated gradient stroke */}
      {animated && (
        <motion.path
          d={path}
          fill="none"
          stroke={`url(#grad-${uniqueId})`}
          strokeWidth={effectiveWidth * 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Data flow particles */}
      {animated && particlesRef.current.map((particle) => {
        const pos = getPointAtProgress(particle.progress);
        return (
          <motion.circle
            key={particle.id}
            cx={pos.x}
            cy={pos.y}
            r={particle.size}
            fill={color}
            opacity={particle.opacity * effectiveGlow}
            filter={`url(#particle-glow-${uniqueId})`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          />
        );
      })}

      {/* Connection points */}
      <motion.circle
        cx={x1}
        cy={y1}
        r={effectiveWidth * 1.5}
        fill={color}
        opacity={0.6 * effectiveGlow}
        filter={`url(#particle-glow-${uniqueId})`}
      />
      <motion.circle
        cx={x2}
        cy={y2}
        r={effectiveWidth * 1.5}
        fill={color}
        opacity={0.6 * effectiveGlow}
        filter={`url(#particle-glow-${uniqueId})`}
      />

      {/* Highlight effect */}
      <AnimatePresence>
        {isHighlighted && (
          <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={effectiveWidth * 2}
            strokeOpacity={0.2}
            filter={`url(#glow-${uniqueId})`}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </AnimatePresence>

      {/* Data packet animation */}
      {animated && isHighlighted && (
        <motion.circle
          r={effectiveWidth * 2}
          fill="#ffffff"
          filter={`url(#particle-glow-${uniqueId})`}
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: '100%' }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            offsetPath: `path('${path}')`,
          }}
        />
      )}
    </svg>
  );
};

// Straight edge variant for simple connections
export const StraightFlowingEdge: React.FC<Omit<FlowingEdgeProps, 'x1' | 'y1' | 'x2' | 'y2'> & {
  source: { x: number; y: number };
  target: { x: number; y: number };
}> = ({
  source,
  target,
  ...props
}) => {
  return (
    <FlowingEdge
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      type="straight"
      {...props}
    />
  );
};

// Curved edge with custom control points
export const CurvedFlowingEdge: React.FC<Omit<FlowingEdgeProps, 'x1' | 'y1' | 'x2' | 'y2'> & {
  source: { x: number; y: number };
  target: { x: number; y: number };
  controlPoint?: { x: number; y: number };
}> = ({
  source,
  target,
  controlPoint,
  ...props
}) => {
  return (
    <FlowingEdge
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      type="bezier"
      {...props}
    />
  );
};

export default FlowingEdge;
