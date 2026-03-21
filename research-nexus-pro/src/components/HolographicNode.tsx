import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface HolographicNodeProps {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color: string;
  status?: 'solved' | 'partial' | 'active' | 'unsolved' | 'verified' | 'untested' | 'failed';
  isSelected?: boolean;
  isHovered?: boolean;
  depth?: number;
  year?: number;
  valueScore?: number;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  darkMode?: boolean;
  pulseIntensity?: number;
}

// Status color mapping with enhanced glow colors
const STATUS_CONFIG: Record<string, { color: string; glow: string; label: string }> = {
  solved: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)', label: 'Solved' },
  partial: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', label: 'Partial' },
  active: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)', label: 'Active' },
  unsolved: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', label: 'Unsolved' },
  verified: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)', label: 'Verified' },
  untested: { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.6)', label: 'Untested' },
  failed: { color: '#6b7280', glow: 'rgba(107, 114, 128, 0.6)', label: 'Failed' },
};

export const HolographicNode: React.FC<HolographicNodeProps> = ({
  id,
  label,
  x,
  y,
  size = 24,
  color,
  status = 'active',
  isSelected = false,
  isHovered = false,
  depth = 0,
  year,
  valueScore,
  onClick,
  onHover,
  darkMode = true,
  pulseIntensity = 1,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [localHovered, setLocalHovered] = useState(false);
  
  // Motion values for 3D tilt effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring animation for tilt
  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), springConfig);
  
  // Status configuration
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const glowIntensity = isSelected ? 1 : localHovered ? 0.8 : 0.4;
  const actualSize = size + (valueScore ? valueScore * 0.3 : 0);
  
  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), depth * 80 + Math.random() * 200);
    return () => clearTimeout(timer);
  }, [depth]);

  // 3D tilt effect handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  }, [mouseX, mouseY]);

  const handleMouseEnter = useCallback(() => {
    setLocalHovered(true);
    onHover?.(true);
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    setLocalHovered(false);
    onHover?.(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [onHover, mouseX, mouseY]);

  // Orbital rings configuration
  const orbitalRings = [
    { radius: 1.4, duration: 8, delay: 0, opacity: 0.15 },
    { radius: 1.8, duration: 12, delay: 2, opacity: 0.1 },
    { radius: 2.2, duration: 16, delay: 4, opacity: 0.08 },
  ];

  return (
    <motion.div
      ref={nodeRef}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isVisible ? 1 : 0, 
        opacity: isVisible ? 1 : 0,
        x,
        y,
      }}
      transition={{ 
        type: "spring",
        stiffness: 400,
        damping: 25,
        delay: depth * 0.05,
      }}
      style={{
        position: 'absolute',
        width: actualSize,
        height: actualSize,
        left: -actualSize / 2,
        top: -actualSize / 2,
        cursor: 'pointer',
        zIndex: isSelected ? 100 : localHovered ? 50 : 10,
        perspective: 1000,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      {/* Outer glow aura */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -actualSize * 0.5,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${statusConfig.glow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          opacity: glowIntensity * pulseIntensity,
        }}
        animate={{
          scale: localHovered ? 1.3 : 1,
          opacity: glowIntensity * pulseIntensity * (localHovered ? 1.2 : 0.8),
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Pulsing ring */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -actualSize * 0.2,
          borderRadius: '50%',
          border: `2px solid ${statusConfig.color}`,
          opacity: 0.3,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.1, 0.3],
        }}
        transition={{
          duration: 2 + Math.random(),
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Orbital rings */}
      {orbitalRings.map((ring, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            inset: -actualSize * (ring.radius - 1) / 2,
            borderRadius: '50%',
            border: `1px solid ${statusConfig.color}`,
            opacity: ring.opacity * glowIntensity,
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: ring.duration,
            repeat: Infinity,
            ease: "linear",
            delay: ring.delay,
          }}
        />
      ))}

      {/* Main 3D sphere */}
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          rotateX,
          rotateY,
        }}
        animate={{
          scale: localHovered ? 1.1 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {/* Base sphere with gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `
              radial-gradient(circle at 30% 30%, 
                ${color} 0%, 
                ${color}dd 30%, 
                ${color}99 60%,
                ${color}66 100%
              )
            `,
            boxShadow: `
              inset -4px -4px 12px rgba(0,0,0,0.4),
              inset 4px 4px 12px rgba(255,255,255,0.3),
              0 0 ${20 * glowIntensity}px ${statusConfig.glow},
              0 0 ${40 * glowIntensity}px ${statusConfig.glow}80
            `,
          }}
        />

        {/* Inner core glow */}
        <div
          style={{
            position: 'absolute',
            inset: '20%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${statusConfig.color} 0%, transparent 70%)`,
            opacity: 0.6,
            filter: 'blur(4px)',
          }}
        />

        {/* Specular highlight */}
        <div
          style={{
            position: 'absolute',
            top: '12%',
            left: '18%',
            width: '35%',
            height: '25%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            filter: 'blur(2px)',
            transform: 'rotate(-30deg)',
          }}
        />

        {/* Secondary highlight */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '10%',
            width: '20%',
            height: '15%',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            filter: 'blur(3px)',
          }}
        />

        {/* Rim light */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '50%',
            border: `2px solid ${statusConfig.color}`,
            opacity: 0.4 * glowIntensity,
            boxShadow: `inset 0 0 10px ${statusConfig.glow}`,
          }}
        />
      </motion.div>

      {/* Selection indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              inset: -actualSize * 0.4,
              borderRadius: '50%',
              border: `3px solid ${statusConfig.color}`,
              boxShadow: `
                0 0 20px ${statusConfig.glow},
                0 0 40px ${statusConfig.glow}80,
                inset 0 0 20px ${statusConfig.glow}40
              `,
            }}
          >
            {/* Rotating selection ring */}
            <motion.div
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                border: `2px dashed ${statusConfig.color}`,
                opacity: 0.5,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator dot */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusConfig.color,
          border: `2px solid ${darkMode ? '#020204' : '#ffffff'}`,
          boxShadow: `0 0 8px ${statusConfig.glow}`,
        }}
        animate={{
          scale: localHovered ? 1.2 : 1,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      />

      {/* Floating tooltip */}
      <AnimatePresence>
        {(localHovered || isSelected) && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 20,
              minWidth: 220,
              maxWidth: 280,
              padding: '14px 18px',
              borderRadius: 16,
              background: darkMode 
                ? 'rgba(8, 8, 12, 0.95)' 
                : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: `1px solid ${statusConfig.color}30`,
              boxShadow: `
                0 24px 48px -12px rgba(0,0,0,0.5),
                0 0 40px ${statusConfig.glow}30
              `,
              color: darkMode ? '#fafafa' : '#18181b',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            {/* Tooltip arrow */}
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${darkMode ? 'rgba(8,8,12,0.95)' : 'rgba(255,255,255,0.95)'}`,
              }}
            />

            {/* Header */}
            <div style={{ marginBottom: 10 }}>
              <h4 style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
                color: statusConfig.color,
                letterSpacing: '-0.01em',
              }}>
                {label}
              </h4>
            </div>

            {/* Metadata grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 16px',
              fontSize: 12,
              color: darkMode ? '#a1a1aa' : '#52525b',
            }}>
              {year && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.6, fontSize: 10 }}>YEAR</span>
                  <span style={{ 
                    fontWeight: 600, 
                    color: darkMode ? '#fafafa' : '#18181b',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{year}</span>
                </div>
              )}
              {valueScore !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.6, fontSize: 10 }}>VALUE</span>
                  <span style={{ 
                    fontWeight: 600, 
                    color: darkMode ? '#fafafa' : '#18181b',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{valueScore.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Status badge */}
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: statusConfig.color,
              }}>
                {statusConfig.label}
              </span>
              
              {/* Mini progress bar for value */}
              {valueScore !== undefined && (
                <div style={{
                  width: 60,
                  height: 4,
                  background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(valueScore / 10) * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      height: '100%',
                      background: `linear-gradient(90deg, ${statusConfig.color}, ${statusConfig.glow})`,
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HolographicNode;
