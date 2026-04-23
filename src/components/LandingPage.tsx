import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Brain, GitBranch, Network, Target, Clock,
  Workflow, ArrowRight, BookOpen, Zap, Lightbulb, ChevronDown,
  Layers, Compass, Star, FileText, Users, Eye, Database,
  Share2, BarChart3, Atom, ChevronRight,
  FileUp, Search, Lightbulb as BulbIcon, TrendingUp,
  GraduationCap, Building2, Map
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

/* ============================================
   LANDING PAGE — Research Nexus Pro
   Product showcase with cinematic scroll-snap.
   ============================================ */

/* ---- SCROLL REVEAL HOOK ---- */
function useScrollReveal(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ---- FULLSCREEN SECTION ---- */
function FullScreenSection({
  children, className = '', id,
}: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`relative h-screen w-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
    >
      {children}
    </section>
  );
}

/* ============================================
   SCREEN 1: HERO — 穿越研究之门
   Hook: 一句话讲清价值
   ============================================ */
function ScreenHero({ onEnter }: { onEnter: () => void }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 100); return () => clearTimeout(t); }, []);

  return (
    <FullScreenSection>
      <div className="absolute inset-0 bg-cover bg-no-repeat scale-105 transition-transform duration-[8s] ease-out"
        style={{
          backgroundImage: `url(${(import.meta as any).env.BASE_URL}images/portal-bg.png)`,
          backgroundPosition: '72% center',
          filter: 'brightness(0.95) contrast(1.15) saturate(1.1)',
          transform: loaded ? 'scale(1)' : 'scale(1.08)',
        }}
      />
      <div className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, rgba(2,2,8,0.94) 0%, rgba(2,2,8,0.7) 20%, rgba(2,2,8,0.3) 40%, rgba(2,2,8,0.08) 55%, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0"
        style={{ background: `linear-gradient(0deg, rgba(2,2,8,0.7) 0%, rgba(2,2,8,0.2) 30%, transparent 60%)` }}
      />
      <Particles />

      <div className="relative z-10 h-full flex flex-col justify-end pb-20 sm:pb-24 px-6 sm:px-12 lg:px-20 w-full">
        <div className={`max-w-xl transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.6)' }} />
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase" style={{ color: 'rgba(0,212,255,0.8)' }}>
              Research Knowledge Graph v2.1
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight leading-[1.1]" style={{ color: 'rgba(255,255,255,0.95)' }}>
            <span className="font-extralight" style={{ color: 'rgba(255,255,255,0.6)' }}>读懂你的研究领域，</span>
            <br />
            只需一张图谱
          </h1>

          <p className="mt-5 text-sm sm:text-base font-light leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Research Nexus Pro 自动将论文转化为可交互的知识图谱。
            <br />
            看清领域格局、追踪方法演进、发现创新机会。
          </p>

          <div className="mt-8 flex items-center gap-4">
            <button onClick={onEnter} className="group relative px-7 py-3 text-sm font-medium tracking-wide overflow-hidden inline-flex items-center gap-2"
              style={{ color: 'rgba(0,220,255,0.95)', border: '1px solid rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.07)', transition: 'all 0.4s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.6)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(0,212,255,0.2), inset 0 0 25px rgba(0,212,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span className="relative z-10 flex items-center gap-2">立即开始探索 <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
              <div className="absolute bottom-0 left-0 h-[1px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)', opacity: 0.5 }} />
            </button>

            <button onClick={() => document.getElementById('screen-problem')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs tracking-wide transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
              了解更多
            </button>
          </div>
        </div>

        <div className={`absolute bottom-8 left-6 sm:left-12 lg:left-20 right-6 sm:right-12 lg:right-20 flex items-end justify-between transition-all duration-1000 delay-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-6 sm:gap-10">
            {[{ v: '309', l: '论文' }, { v: '313', l: '问题' }, { v: '425', l: '方法' }, { v: '1029', l: '关系' }].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-lg sm:text-xl font-light" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.v}</div>
                <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => document.getElementById('screen-problem')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1.5 group">
            <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Scroll</span>
            <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.2)' }} className="group-hover:animate-bounce" />
          </button>
        </div>
      </div>
    </FullScreenSection>
  );
}

/* ============================================
   SCREEN 2: PROBLEM — 你被困住了吗
   先建立共鸣：研究者的真实痛点
   ============================================ */
const PAIN_POINTS = [
  {
    icon: Search,
    title: '论文越读越多，视野越来越窄',
    desc: '下载了上百篇 PDF，笔记做了几千字，却只见树木不见森林。领域全貌？依然模糊。',
  },
  {
    icon: TrendingUp,
    title: '方法层出不穷，难以判断价值',
    desc: '每年几百篇新方法论文，哪些是真突破、哪些是旧酒装新瓶？缺乏系统性的方法演进追踪。',
  },
  {
    icon: Map,
    title: '交叉创新靠运气，没有系统方法',
    desc: '想做一个跨领域的研究，却不知道哪些方法可以迁移、哪些问题还没被解决。灵感？全凭运气。',
  },
];

function ScreenProblem() {
  const { ref, visible } = useScrollReveal(0.2);
  return (
    <FullScreenSection id="screen-problem">
      <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${(import.meta as any).env.BASE_URL}images/portal-bg-clean.png)`,
        filter: 'brightness(0.65) contrast(1.15)',
      }} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 30% 50%, rgba(2,2,8,0.6) 0%, rgba(2,2,8,0.45) 40%, rgba(2,2,8,0.75) 100%)`,
      }} />

      <div ref={ref} className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-12">
        <div className={`text-center mb-14 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-[1px]" style={{ background: 'rgba(244,63,94,0.5)' }} />
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(244,63,94,0.7)' }}>研究者的困境</span>
            <div className="w-8 h-[1px]" style={{ background: 'rgba(244,63,94,0.5)' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            研究领域的迷雾，<span className="font-extralight" style={{ color: 'rgba(244,63,94,0.8)' }}>你被困住了吗</span>
          </h2>
          <p className="mt-3 text-sm font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>
            每天面对海量论文，却找不到方向——这是当代研究者的共同困境
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PAIN_POINTS.map((p, i) => (
            <div key={p.title}
              className={`group relative p-6 rounded-lg transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{
                transitionDelay: `${300 + i * 150}ms`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(244,63,94,0.35)'; e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <div className="absolute top-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(90deg, transparent, rgba(244,63,94,0.5), transparent)' }} />
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: 'rgba(244,63,94,0.8)' }}>
                <p.icon size={18} />
              </div>
              <h3 className="text-base font-medium mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.title}</h3>
              <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '900ms' }}>
        <button onClick={() => document.getElementById('screen-solution')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1.5 group">
          <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Solution</span>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.2)' }} className="group-hover:animate-bounce" />
        </button>
      </div>
    </FullScreenSection>
  );
}

/* ============================================
   SCREEN 3: SOLUTION — 三步解决
   我们做了什么 + 怎么做到的
   ============================================ */
const STEPS = [
  {
    num: '01',
    icon: FileUp,
    title: '上传 PDF',
    subtitle: 'AI 自动提取',
    desc: '问题、方法、引用关系——一键结构化。无需手动整理，让 AI 做苦力。',
    color: '#06b6d4',
  },
  {
    num: '02',
    icon: Network,
    title: '生成交互图谱',
    subtitle: '三维可视化',
    desc: '问题树 × 方法树 × 引文网络。拖拽、缩放、探索——一眼看清领域格局。',
    color: '#8b5cf6',
  },
  {
    num: '03',
    icon: BulbIcon,
    title: 'AI 智能分析',
    subtitle: '自动发现机会',
    desc: '识别研究缺口、推荐交叉方向、评估实验可行性。创新不再靠运气。',
    color: '#f472b6',
  },
];

function ScreenSolution() {
  const { ref, visible } = useScrollReveal(0.2);
  return (
    <FullScreenSection id="screen-solution">
      <div className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-[10s] ease-out"
        style={{
          backgroundImage: `url(${(import.meta as any).env.BASE_URL}images/knowledge-universe.png)`,
          filter: 'brightness(0.45) contrast(1.2)',
          transform: visible ? 'scale(1)' : 'scale(1.05)',
        }}
      />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(2,2,8,0.65) 60%, rgba(2,2,8,0.92) 100%)`,
      }} />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(180deg, rgba(2,2,8,0.7) 0%, transparent 30%, transparent 70%, rgba(2,2,8,0.7) 100%)`,
      }} />

      <div ref={ref} className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-12">
        <div className={`text-center mb-14 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-[1px]" style={{ background: 'rgba(139,92,246,0.5)' }} />
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(139,92,246,0.7)' }}>解决方案</span>
            <div className="w-8 h-[1px]" style={{ background: 'rgba(139,92,246,0.5)' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            一张图谱，<span className="font-extralight" style={{ color: 'rgba(167,139,250,0.8)' }}>看清全局</span>
          </h2>
          <p className="mt-3 text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
            三步从 PDF 到洞察，让研究效率提升 10 倍
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <div key={step.num}
              className={`group relative p-6 rounded-lg transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{
                transitionDelay: `${300 + i * 150}ms`,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${step.color}30`; e.currentTarget.style.background = `${step.color}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              <div className="absolute top-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${step.color}60, transparent)` }} />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${step.color}10`, border: `1px solid ${step.color}20`, color: step.color }}>
                  <step.icon size={18} />
                </div>
                <div>
                  <span className="text-[10px] tracking-widest uppercase" style={{ color: `${step.color}80` }}>{step.subtitle}</span>
                  <h3 className="text-base font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{step.title}</h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '900ms' }}>
        <button onClick={() => document.getElementById('screen-features')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1.5 group">
          <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Features</span>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.2)' }} className="group-hover:animate-bounce" />
        </button>
      </div>
    </FullScreenSection>
  );
}

/* ============================================
   SCREEN 4: FEATURES — 核心能力
   用户视角：你能获得什么
   ============================================ */
const CAPABILITIES = [
  {
    icon: Search,
    title: '领域全景',
    benefit: '一眼看清格局',
    desc: '问题树 + 方法树双维度展开，谁在研究什么问题、用了什么方法，一目了然。',
    color: '#06b6d4',
  },
  {
    icon: TrendingUp,
    title: '方法演进',
    benefit: '不错过任何拐点',
    desc: '追踪技术方法的完整发展脉络，从起源到最新变种，掌握领域技术路线。',
    color: '#8b5cf6',
  },
  {
    icon: Zap,
    title: '交叉雷达',
    benefit: '突破创新瓶颈',
    desc: 'AI 自动识别跨领域方法迁移机会，推荐问题 × 方法的创新组合。',
    color: '#f472b6',
  },
  {
    icon: Brain,
    title: '深度分析',
    benefit: '节省数小时调研',
    desc: '一键生成多维度文献综述，自动识别研究缺口、评估实验可行性。',
    color: '#22d3ee',
  },
];

function ScreenFeatures() {
  const { ref, visible } = useScrollReveal(0.2);
  return (
    <FullScreenSection id="screen-features">
      <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${(import.meta as any).env.BASE_URL}images/philosophy-bg.png)`,
        filter: 'brightness(0.55) contrast(1.15)',
      }} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 50% 40%, rgba(2,2,8,0.35) 0%, rgba(2,2,8,0.5) 45%, rgba(2,2,8,0.72) 100%)`,
      }} />

      <div ref={ref} className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-12">
        <div className={`text-center mb-12 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(0,212,255,0.6)' }}>核心能力</span>
            <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            不止于可视化，<span className="font-extralight" style={{ color: 'rgba(0,212,255,0.7)' }}>更是你的研究助手</span>
          </h2>
          <p className="mt-3 text-sm font-light" style={{ color: 'rgba(255,255,255,0.65)' }}>
            四大核心能力，覆盖从文献调研到创新发现的完整研究流程
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAPABILITIES.map((cap, i) => (
            <div key={cap.title}
              className={`group relative p-6 rounded-lg transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{
                transitionDelay: `${300 + i * 120}ms`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${cap.color}40`; e.currentTarget.style.background = `${cap.color}0a`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <div className="absolute top-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${cap.color}60, transparent)` }} />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cap.color}10`, border: `1px solid ${cap.color}20`, color: cap.color }}>
                  <cap.icon size={18} />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-base font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{cap.title}</h3>
                    <span className="text-[10px] tracking-wider" style={{ color: `${cap.color}90` }}>{cap.benefit}</span>
                  </div>
                  <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.7)' }}>{cap.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '900ms' }}>
        <button onClick={() => document.getElementById('screen-cta')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1.5 group">
          <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Start</span>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.2)' }} className="group-hover:animate-bounce" />
        </button>
      </div>
    </FullScreenSection>
  );
}

/* ============================================
   SCREEN 5: CTA — 开始探索
   ============================================ */
function ScreenCTA({ onEnter }: { onEnter: () => void }) {
  const { ref, visible } = useScrollReveal(0.3);
  return (
    <FullScreenSection id="screen-cta">
      <div className="absolute inset-0 bg-cover bg-bottom" style={{
        backgroundImage: `url(${(import.meta as any).env.BASE_URL}images/journey-bg.png)`,
        filter: 'brightness(0.5) contrast(1.15)',
      }} />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(90deg, rgba(2,2,8,0.72) 0%, rgba(2,2,8,0.5) 35%, rgba(2,2,8,0.2) 60%, rgba(2,2,8,0.05) 100%)`,
      }} />

      <div ref={ref} className="relative z-10 text-center px-6 max-w-2xl">
        <div className={`inline-flex items-center gap-2 mb-6 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '200ms' }}>
          <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.5)' }} />
          <Sparkles size={12} style={{ color: 'rgba(0,212,255,0.7)' }} />
          <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.5)' }} />
        </div>

        <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '400ms', color: 'rgba(255,255,255,0.98)' }}>
          准备好开启
          <br />
          <span className="font-extralight" style={{ color: 'rgba(0,220,255,0.85)' }}>你的研究之旅了吗</span>
        </h2>

        <p className={`mt-5 text-sm font-light transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '600ms', color: 'rgba(255,255,255,0.7)' }}>
          加入研究者们的知识图谱探索
        </p>

        <div className={`mt-6 flex items-center justify-center gap-6 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '700ms' }}>
          {[{ v: '309', l: '论文' }, { v: '313', l: '问题' }, { v: '425', l: '方法' }, { v: '1029', l: '关系' }].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-xl font-light" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.v}</div>
              <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className={`mt-10 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '800ms' }}>
          <button onClick={onEnter}
            className="group relative px-8 py-3 text-sm font-medium tracking-wide overflow-hidden inline-flex items-center gap-2"
            style={{ color: 'rgba(0,220,255,0.95)', border: '1px solid rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.07)', transition: 'all 0.4s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.6)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(0,212,255,0.2), inset 0 0 30px rgba(0,212,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            立即开始探索
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            <div className="absolute bottom-0 left-0 h-[1px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)', opacity: 0.5 }} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={12} style={{ color: 'rgba(0,212,255,0.4)' }} />
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Research Nexus Pro v3.0</span>
        </div>
      </div>
    </FullScreenSection>
  );
}

/* ============================================
   FEATURES SECTION (below cinematic screens)
   Detailed feature cards with navigation
   ============================================ */
const FEATURE_GROUPS = [
  {
    title: '问题发现',
    description: '从海量论文中识别核心研究问题，构建层次化的问题树',
    icon: Search,
    color: '#06b6d4',
    routes: [
      { name: '创新面板', path: 'app/innovation-board', icon: Sparkles, desc: 'AI 驱动的创新机会发现' },
      { name: '问题树', path: 'app/problem-tree', icon: GitBranch, desc: '层次化问题结构可视化' },
      { name: '时间演进', path: 'app/timeline', icon: Clock, desc: '问题演变的历史脉络' },
    ],
  },
  {
    title: '方法探索',
    description: '追踪方法演进路径，发现跨领域方法迁移机会',
    icon: Target,
    color: '#a855f7',
    routes: [
      { name: '方法树', path: 'app/method-tree', icon: Target, desc: '方法分类与层次结构' },
      { name: '方法演进', path: 'app/method-timeline', icon: BarChart3, desc: '方法发展的历史轨迹' },
      { name: '方法→问题', path: 'app/method-arrows', icon: ArrowRight, desc: '方法到问题的映射' },
    ],
  },
  {
    title: '论文与引用',
    description: '可视化论文引用网络，追踪研究脉络与影响力',
    icon: BookOpen,
    color: '#22d3ee',
    routes: [
      { name: '论文时间线', path: 'app/paper-timeline', icon: Clock, desc: '论文发表时间线' },
      { name: '引文网络', path: 'app/citation', icon: Network, desc: '论文引用关系图' },
      { name: '论文库', path: 'paper-repository', icon: FileText, desc: '个人论文收藏管理' },
    ],
  },
  {
    title: '智能助手',
    description: 'AI 驱动的研究辅助工具，加速创新发现',
    icon: Zap,
    color: '#f472b6',
    routes: [
      { name: '收藏夹', path: 'favorites', icon: Star, desc: '创新点收藏与管理' },
      { name: '用户工作台', path: 'user-workspace', icon: Users, desc: '个人研究空间' },
    ],
  },
];

function FeatureCard({ group, index }: { group: typeof FEATURE_GROUPS[0]; index: number }) {
  const navigate = useNavigate();
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref}
      className={`group relative overflow-hidden rounded-lg transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      style={{ transitionDelay: `${index * 120}ms`, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${group.color}60, transparent)` }} />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${group.color}10`, border: `1px solid ${group.color}20`, color: group.color }}>
            <group.icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{group.title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{group.description}</p>
          </div>
        </div>
        <div className="space-y-0.5">
          {group.routes.map(route => (
            <button key={route.path} onClick={() => navigate(route.path)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all duration-200 group/item"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <route.icon size={13} style={{ color: group.color, opacity: 0.6 }} />
              <div className="flex-1 min-w-0">
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{route.name}</span>
                <span className="block text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>{route.desc}</span>
              </div>
              <ChevronRight size={13} className="opacity-0 group-hover/item:opacity-100 transition-opacity" style={{ color: 'rgba(255,255,255,0.3)' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   TECH STACK
   ============================================ */
const TECH_STACK = [
  { name: 'React 18', icon: Atom, desc: '现代 UI 框架' },
  { name: 'TypeScript', icon: FileText, desc: '类型安全' },
  { name: 'Tailwind CSS', icon: Layers, desc: '原子化样式' },
  { name: 'FastAPI', icon: Zap, desc: '高性能后端' },
  { name: 'NetworkX', icon: Share2, desc: '图算法' },
  { name: 'ReactFlow', icon: Network, desc: '图谱可视化' },
];

function TechStack() {
  const { ref, visible } = useScrollReveal();
  return (
    <section ref={ref} className="py-24 px-6 sm:px-12 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <div className={`text-center mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-6 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(0,212,255,0.6)' }}>技术栈</span>
            <div className="w-6 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
          </div>
          <h2 className="text-xl sm:text-2xl font-light" style={{ color: 'rgba(255,255,255,0.85)' }}>构建于现代技术之上</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TECH_STACK.map((tech, i) => (
            <div key={tech.name}
              className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 80}ms`, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                <tech.icon size={16} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{tech.name}</div>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{tech.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================
   FLOATING PARTICLES (Canvas)
   ============================================ */
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; decay: number; }> = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);
    const spawn = () => {
      if (particles.length < 30 && Math.random() < 0.05) {
        const portalX = canvas.offsetWidth * 0.72 + (Math.random() - 0.5) * canvas.offsetWidth * 0.15;
        const portalY = canvas.offsetHeight * 0.3 + Math.random() * canvas.offsetHeight * 0.5;
        particles.push({ x: portalX, y: portalY, vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.4 - 0.1, size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.5 + 0.2, decay: Math.random() * 0.003 + 0.001 });
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      spawn();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 220, 255, ${p.alpha})`; ctx.fill();
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animationId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />;
}

/* ============================================
   MAIN
   ============================================ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { viewConfig, updateViewConfig } = useAppStore();
  const [isDark, setIsDark] = useState(viewConfig.darkMode ?? true);

  useEffect(() => {
    if (viewConfig.darkMode !== isDark) updateViewConfig({ darkMode: isDark });
  }, [isDark, viewConfig.darkMode, updateViewConfig]);

  const handleEnter = useCallback(() => navigate('app/innovation-board'), [navigate]);

  return (
    <div className="relative h-screen overflow-y-auto" style={{ scrollSnapType: 'y mandatory', background: isDark ? '#020204' : '#fafafa' }} data-theme={isDark ? 'dark' : 'light'}>
      {/* Theme toggle */}
      <div className="fixed top-5 right-5 z-50">
        <button onClick={() => setIsDark(!isDark)}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
          {isDark ? <Lightbulb size={14} /> : <Sparkles size={14} />}
        </button>
      </div>

      {/* ===== CINEMATIC SCREENS (scroll-snap) ===== */}
      <ScreenHero onEnter={handleEnter} />
      <ScreenProblem />
      <ScreenSolution />
      <ScreenFeatures />
      <ScreenCTA onEnter={handleEnter} />

      {/* ===== NORMAL SCROLL CONTENT (no snap) ===== */}
      <div style={{ scrollSnapAlign: 'none' }}>
        <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)' }} />

        <section className="py-24 px-6 sm:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
                <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(0,212,255,0.6)' }}>功能模块</span>
                <div className="w-8 h-[1px]" style={{ background: 'rgba(0,212,255,0.4)' }} />
              </div>
              <h2 className="text-xl sm:text-2xl font-light" style={{ color: 'rgba(255,255,255,0.85)' }}>四大核心维度</h2>
              <p className="mt-2 text-sm font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>从问题发现到方法探索，从论文分析到创新生成</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURE_GROUPS.map((group, i) => <FeatureCard key={group.title} group={group} index={i} />)}
            </div>
          </div>
        </section>

        <TechStack />

        <footer className="py-6 px-6 sm:px-12 lg:px-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={12} style={{ color: 'rgba(0,212,255,0.5)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Research Nexus Pro v2.1</span>
            </div>
            <span className="text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>研究知识图谱系统</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
