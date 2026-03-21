import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HolographicNodeProps {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color: string;
  status?: 'solved' | 'partial' | 'active' | 'unsolved' | 'verified' | 'untested';
  isSelected?: boolean;
  isHovered?: boolean;
  depth?: number;
  year?: number;
  valueScore?: number;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  darkMode?: boolean;
}

// 状态对应的脉动颜色
const STATUS_PULSE: Record<string, string> = {
  solved: '#22c55e',
  partial: '#f59e0b', 
  active: '#3b82f6',
  unsolved: '#ef4444',
  verified: '#22c55e',
  untested: '#8b5cf6',
  failed: '#6b7280'
};

export const HolographicNode: React.FC<HolographicNodeProps> = ({
  id,
  label,
  x,
  y,
  size = 20,
  color,
  status = 'active',
  isSelected = false,
  isHovered = false,
  depth = 0,
  year,
  valueScore,
  onClick,
  onHover,
  darkMode = true
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  
  // 进入视口动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), Math.random() * 300);
    return () => clearTimeout(timer);
  }, []);

  // 3D 倾斜效果
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateX = (e.clientY - centerY) / 10;
    const rotateY = (centerX - e.clientX) / 10;
    setMousePos({ x: rotateY, y: rotateX });
  };

  const pulseColor = STATUS_PULSE[status] || color;
  const glowIntensity = isSelected ? 1 : isHovered ? 0.7 : 0.4;
  
  return (
    <motion.div
      ref={nodeRef}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isVisible ? 1 : 0, 
        opacity: isVisible ? 1 : 0,
        x,
        y
      }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 20,
        delay: depth * 0.1
      }}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        left: -size / 2,
        top: -size / 2,
        cursor: 'pointer',
        zIndex: isSelected ? 100 : isHovered ? 50 : 10,
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => {
        onHover?.(false);
        setMousePos({ x: 0, y: 0 });
      }}
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      {/* 外圈光晕 */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${pulseColor}${Math.round(glowIntensity * 40).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        animate={{
          scale: isHovered ? 1.3 : 1,
          opacity: isSelected ? 1 : 0.6,
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* 脉动光环 */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          border: `2px solid ${pulseColor}`,
          opacity: 0.3,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.1, 0.3],
        }}
        transition={{
          duration: 2 + Math.random(),
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* 主节点球体 */}
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 30% 30%, 
              ${color}ee 0%, 
              ${color}99 40%, 
              ${color}66 100%
            )
          `,
          boxShadow: `
            inset -2px -2px 6px rgba(0,0,0,0.3),
            inset 2px 2px 6px rgba(255,255,255,0.2),
            0 0 ${20 * glowIntensity}px ${pulseColor}${Math.round(glowIntensity * 80).toString(16).padStart(2, '0')},
            0 0 ${40 * glowIntensity}px ${pulseColor}${Math.round(glowIntensity * 40).toString(16).padStart(2, '0')}
          `,
          transform: `perspective(500px) rotateX(${mousePos.y}deg) rotateY(${mousePos.x}deg)`,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          scale: isHovered ? 1.15 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      />
      
      {/* 高光反射 */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: '30%',
          height: '20%',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
          filter: 'blur(1px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* 选中标记 */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: '50%',
              border: `3px solid ${pulseColor}`,
              boxShadow: `0 0 20px ${pulseColor}, inset 0 0 20px ${pulseColor}40`,
            }}
          />
        )}
      </AnimatePresence>
      
      {/* 悬浮信息卡片 */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 16,
              minWidth: 200,
              padding: '12px 16px',
              borderRadius: 12,
              background: darkMode 
                ? 'rgba(8, 8, 16, 0.95)' 
                : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${pulseColor}30`,
              boxShadow: `
                0 20px 25px -5px rgba(0,0,0,0.3),
                0 0 30px ${pulseColor}20
              `,
              color: darkMode ? '#f8fafc' : '#0f172a',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            {/* 小三角 */}
            <div
              style={{
                position: 'absolute',
                bottom: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `6px solid ${darkMode ? 'rgba(8,8,16,0.95)' : 'rgba(255,255,255,0.95)'}`,
              }}
            />
            
            <h4 style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
              color: pulseColor,
            }}>
              {label}
            </h4>
            
            <div style={{
              display: 'flex',
              gap: 12,
              fontSize: 11,
              color: darkMode ? '#94a3b8' : '#64748b',
            }}>
              {year && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ opacity: 0.6 }}>Year:</span>
                  <span style={{ fontWeight: 500, color: darkMode ? '#f8fafc' : '#0f172a' }}>{year}</span>
                </span>
              )}
              {valueScore !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ opacity: 0.6 }}>Value:</span>
                  <span style={{ fontWeight: 500, color: darkMode ? '#f8fafc' : '#0f172a' }}>{valueScore}/10</span>
                </span>
              )}
            </div>
            
            <div style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: pulseColor,
              fontWeight: 500,
            }}>
              {status}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HolographicNode;
