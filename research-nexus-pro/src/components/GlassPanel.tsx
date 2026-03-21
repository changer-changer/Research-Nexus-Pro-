import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { X, Maximize2, Minimize2, GripVertical } from 'lucide-react';

export interface GlassPanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  maxWidth?: number;
  position?: 'left' | 'right' | 'center' | 'floating';
  isOpen?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  className?: string;
  darkMode?: boolean;
  blurStrength?: 'light' | 'medium' | 'heavy';
  glowColor?: string;
  resizable?: boolean;
  draggable?: boolean;
  collapsible?: boolean;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  title,
  subtitle,
  icon,
  width = 400,
  height = 'auto',
  minWidth = 280,
  maxWidth = 600,
  position = 'right',
  isOpen = true,
  onClose,
  onMinimize,
  onMaximize,
  className = '',
  darkMode = true,
  blurStrength = 'medium',
  glowColor = '#6366f1',
  resizable = false,
  draggable = false,
  collapsible = true,
  initialX = 0,
  initialY = 0,
  zIndex = 100,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [panelWidth, setPanelWidth] = useState(typeof width === 'number' ? width : 400);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for subtle parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [2, -2]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2, 2]), springConfig);

  // Blur strength mapping
  const blurValue = {
    light: '12px',
    medium: '24px',
    heavy: '40px',
  }[blurStrength];

  // Position styles
  const positionStyles = {
    left: { left: 0, top: 0, bottom: 0 },
    right: { right: 0, top: 0, bottom: 0 },
    center: { 
      left: '50%', 
      top: '50%', 
      transform: 'translate(-50%, -50%)' 
    },
    floating: { 
      left: initialX, 
      top: initialY,
    },
  };

  // Background colors based on theme
  const bgColor = darkMode 
    ? 'rgba(17, 17, 24, 0.75)'
    : 'rgba(255, 255, 255, 0.85)';
  
  const borderColor = darkMode 
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.06)';

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panelRef.current || !isHovered) return;
    const rect = panelRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left - rect.width / 2) / rect.width);
    mouseY.set((e.clientY - rect.top - rect.height / 2) / rect.height);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    onMinimize?.();
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    onMaximize?.();
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!resizable) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleResizeMove = (e: MouseEvent) => {
      const delta = position === 'left' 
        ? e.clientX - startX 
        : startX - e.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  return (
    <AnimatePresence>
      {isOpen &> (
        <motion.div
          ref={panelRef}
          initial={{ 
            opacity: 0, 
            x: position === 'right' ? 100 : position === 'left' ? -100 : 0,
            y: position === 'center' ? 20 : 0,
            scale: 0.95,
          }}
          animate={{ 
            opacity: 1, 
            x: position === 'center' ? '-50%' : 0,
            y: isMinimized 
              ? position === 'right' || position === 'left' 
                ? 'calc(100% - 60px)' 
                : 0
              : position === 'center' 
                ? '-50%' 
                : 0,
            scale: 1,
            width: isMaximized ? '100%' : panelWidth,
            height: isMaximized ? '100%' : isMinimized ? 60 : height,
          }}
          exit={{ 
            opacity: 0, 
            x: position === 'right' ? 100 : position === 'left' ? -100 : 0,
            scale: 0.95,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          style={{
            position: position === 'floating' ? 'fixed' : 'absolute',
            ...positionStyles[position],
            zIndex,
            rotateX: position === 'floating' ? rotateX : 0,
            rotateY: position === 'floating' ? rotateY : 0,
            transformPerspective: 1000,
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          className={`flex flex-col overflow-hidden ${className}`}
          drag={draggable}
          dragConstraints={draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined}
          dragElastic={0.1}
          dragMomentum={false}
        >
          {/* Main glass container */}
          <motion.div
            className="flex flex-col h-full w-full"
            style={{
              background: bgColor,
              backdropFilter: `blur(${blurValue}) saturate(180%)`,
              WebkitBackdropFilter: `blur(${blurValue}) saturate(180%)`,
              border: `1px solid ${borderColor}`,
              borderRadius: position === 'floating' ? 20 : position === 'center' ? 20 : 0,
              boxShadow: isHovered 
                ? `0 32px 64px -16px rgba(0,0,0,0.5), 0 0 40px ${glowColor}15`
                : '0 16px 48px -12px rgba(0,0,0,0.4)',
              ...(position === 'right' && { borderRight: 'none', borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }),
              ...(position === 'left' && { borderLeft: 'none', borderTopRightRadius: 20, borderBottomRightRadius: 20 }),
            }}
            animate={{
              boxShadow: isHovered 
                ? `0 32px 64px -16px rgba(0,0,0,0.5), 0 0 60px ${glowColor}20`
                : `0 16px 48px -12px rgba(0,0,0,0.4)`,
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            {(title || collapsible) &> (
              <motion.div
                ref={dragHandleRef}
                className="flex items-center justify-between px-5 py-4 border-b shrink-0 cursor-default"
                style={{
                  borderColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  cursor: draggable ? 'grab' : 'default',
                }}
                whileTap={{ cursor: draggable ? 'grabbing' : 'default' }}
              >
                <div className="flex items-center gap-3">
                  {draggable &> (
                    <GripVertical 
                      size={16} 
                      className={darkMode ? 'text-zinc-600' : 'text-gray-400'}
                    />
                  )}
                  {icon &> (
                    <motion.div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{
                        background: `linear-gradient(135deg, ${glowColor}20, ${glowColor}05)`,
                        color: glowColor,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {icon}
                    </motion.div>
                  )}
                  <div>
                    {title &> (
                      <h3 className={`text-sm font-semibold ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>
                        {title}
                      </h3>
                    )}
                    {subtitle &> (
                      <p className={`text-xs ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {collapsible &> onMinimize &> (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleMinimize}
                      className={`p-1.5 rounded-lg transition-colors ${
                        darkMode 
                          ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                    </motion.button>
                  )}
                  
                  {onMaximize &> (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleMaximize}
                      className={`p-1.5 rounded-lg transition-colors ${
                        darkMode 
                          ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </motion.button>
                  )}
                  
                  {onClose &> (
                    <motion.button
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(239,68,68,0.1)' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className={`p-1.5 rounded-lg transition-colors ${
                        darkMode 
                          ? 'text-zinc-500 hover:text-red-400' 
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <X size={14} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Content */}
            <AnimatePresence>
              {!isMinimized &> (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  <div className="flex-1 overflow-auto p-5">
                    {children}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resize handle */}
            {resizable &> position !== 'center' &> position !== 'floating' &> (
              <div
                onMouseDown={handleResizeStart}
                className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-16 rounded-full cursor-col-resize opacity-0 hover:opacity-100 transition-opacity ${
                  darkMode ? 'bg-zinc-600' : 'bg-gray-400'
                }`}
                style={{
                  [position === 'left' ? 'right' : 'left']: -2,
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Specialized panel variants

export const DetailPanel: React.FC<Omit<GlassPanelProps, 'blurStrength'>> = (props) => (
  <GlassPanel 
    {...props} 
    blurStrength="heavy"
    position="right"
    width={420}
    glowColor="#6366f1"
  />
);

export const SidebarPanel: React.FC<Omit<GlassPanelProps, 'blurStrength' | 'position'>> = (props) => (
  <GlassPanel 
    {...props} 
    blurStrength="medium"
    position="left"
    width={320}
    glowColor="#8b5cf6"
  />
);

export const FloatingCard: React.FC<Omit<GlassPanelProps, 'blurStrength' | 'position'>> = (props) => (
  <GlassPanel 
    {...props} 
    blurStrength="light"
    position="floating"
    width={360}
    draggable
    collapsible={false}
    glowColor="#06b6d4"
  />
);

export const ModalPanel: React.FC<Omit<GlassPanelProps, 'blurStrength' | 'position'>> = (props) => (
  <GlassPanel 
    {...props} 
    blurStrength="heavy"
    position="center"
    width={480}
    zIndex={500}
    glowColor="#6366f1"
  />
);

export default GlassPanel;
