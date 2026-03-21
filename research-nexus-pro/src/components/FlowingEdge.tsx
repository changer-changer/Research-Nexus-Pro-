import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface FlowingEdgeProps {
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
  particleCount = 3
}) => {
  // 计算连线路径
  const path = useMemo(() => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // 使用贝塞尔曲线创造流畅的弧度
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const curvature = length * 0.2;
    
    return `M ${x1} ${y1} Q ${midX} ${midY - curvature} ${x2} ${y2}`;
  }, [x1, y1, x2, y2]);

  const glowIntensity = isHighlighted ? 1 : 0.5;
  
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
      }}
    >
      <defs>
        {/* 渐变定义 */}
        <linearGradient id={`gradient-${x1}-${y1}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.2 * glowIntensity} />
          <stop offset="50%" stopColor={color} stopOpacity={0.8 * glowIntensity} />
          <stop offset="100%" stopColor={color} stopOpacity={0.2 * glowIntensity} />
        </linearGradient>
        
        {/* 发光滤镜 */}
        <filter id={`glow-${x1}-${y1}`}>
          <feGaussianBlur stdDeviation={isHighlighted ? 4 : 2} result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* 基础连线 */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={0.3 * glowIntensity}
        strokeDasharray={isDashed ? "5,5" : undefined}
        filter={`url(#glow-${x1}-${y1})`}
      />
      
      {/* 流光效果 */}
      {animated && (
        <>
          {/* 流动粒子 */}
          {Array.from({ length: particleCount }).map((_, i) => (
            <motion.circle
              key={i}
              r={isHighlighted ? 4 : 2}
              fill={color}
              filter={`url(#glow-${x1}-${y1})`}
              initial={{ offsetDistance: '0%' }}
              animate={{ offsetDistance: '100%' }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.7,
              }}
              style={{
                offsetPath: `path('${path}')`,
              }}
            />
          ))}
          
          {/* 渐变流光 */}
          <motion.path
            d={path}
            fill="none"
            stroke={`url(#gradient-${x1}-${y1})`}
            strokeWidth={width * 1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 1],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </>
      )}
      
      {/* 高亮时的光晕 */}
      {isHighlighted && (
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={width * 3}
          strokeOpacity={0.2}
          filter={`url(#glow-${x1}-${y1})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </svg>
  );
};

// 简单的直线版本
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
      {...props}
    />
  );
};

export default FlowingEdge;
