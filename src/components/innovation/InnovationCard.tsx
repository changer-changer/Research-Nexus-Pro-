/**
 * Innovation Card Component
 * 创新点展示卡片
 */

import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Target, Wrench, Sparkles, FlaskConical, Clock } from 'lucide-react';

interface Innovation {
  id: string;
  title: string;
  description: string;
  paradigm: string;
  target_problem: string;
  candidate_method: string;
  core_insight: string;
  source_papers: string[];
  novelty_score: number;
  feasibility_score: number;
  impact_score: number;
  urgency_score?: number;
  composite_score: number;
  mvp_experiment?: string;
  created_at: string;
}

interface InnovationCardProps {
  innovation: Innovation;
  index?: number;
}

const PARADIGM_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  CDT: { bg: 'bg-purple-100', text: 'text-purple-800', icon: <Target className="w-4 h-4" /> },
  SHF: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Wrench className="w-4 h-4" /> },
  MC: { bg: 'bg-green-100', text: 'text-green-800', icon: <Sparkles className="w-4 h-4" /> },
  TF: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <Clock className="w-4 h-4" /> },
  CH: { bg: 'bg-red-100', text: 'text-red-800', icon: <Lightbulb className="w-4 h-4" /> },
  RGI: { bg: 'bg-teal-100', text: 'text-teal-800', icon: <FlaskConical className="w-4 h-4" /> },
};

const PARADIGM_NAMES: Record<string, string> = {
  CDT: '跨域迁移',
  SHF: '结构洞填补',
  MC: '方法组合',
  TF: '时间前沿',
  CH: '反事实假设',
  RGI: '研究缺口',
};

export const InnovationCard: React.FC<InnovationCardProps> = ({ 
  innovation,
  index = 0
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const colors = PARADIGM_COLORS[innovation.paradigm] || PARADIGM_COLORS.CDT;
  
  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-4 h-4 ${
              i < fullStars 
                ? 'text-yellow-400 fill-yellow-400'
                : i === fullStars && hasHalf
                ? 'text-yellow-400 fill-yellow-400 opacity-50'
                : 'text-gray-300'
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-1 text-sm text-gray-600">{score.toFixed(1)}</span>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-gray-100">
      {/* 头部 */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* 范式标签 */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                {colors.icon}
                {innovation.paradigm} - {PARADIGM_NAMES[innovation.paradigm]}
              </span>
              <span className="text-xs text-gray-400">
                #{String(index + 1).padStart(2, '0')}
              </span>
            </div>
            
            {/* 标题 */}
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {innovation.title}
            </h3>
          </div>
          
          {/* 综合评分 */}
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-blue-600">
              {innovation.composite_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">综合得分</div>
          </div>
        </div>
        
        {/* 一句话总结 */}
        <p className="mt-3 text-gray-600 text-sm leading-relaxed">
          {innovation.description}
        </p>
        
        {/* 核心洞察 */}
        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
          <span className="font-medium text-gray-700">核心洞察: </span>
          <span className="text-gray-600">{innovation.core_insight}</span>
        </div>
        
        {/* 评分概览 */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">新颖性</div>
            {renderStars(innovation.novelty_score)}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">可行性</div>
            {renderStars(innovation.feasibility_score)}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">影响力</div>
            {renderStars(innovation.impact_score)}
          </div>
        </div>
      </div>
      
      {/* 展开详情 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <div className="space-y-4">
            {/* 目标问题 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Target className="w-4 h-4 text-red-500" />
                目标问题
              </h4>
              <p className="text-sm text-gray-600 bg-red-50 rounded-lg p-2">
                {innovation.target_problem}
              </p>
            </div>
            
            {/* 候选方法 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-500" />
                候选方法
              </h4>
              <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-2">
                {innovation.candidate_method}
              </p>
            </div>
            
            {/* 实验设计 */}
            {innovation.mvp_experiment && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-green-500" />
                  MVP实验设计
                </h4>
                <p className="text-sm text-gray-600 bg-green-50 rounded-lg p-2">
                  {innovation.mvp_experiment}
                </p>
              </div>
            )}
            
            {/* 源论文 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">
                源论文 ({innovation.source_papers.length}篇)
              </h4>
              <div className="flex flex-wrap gap-2">
                {innovation.source_papers.map((paper, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600"
                  >
                    {paper}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 展开按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium flex items-center justify-center gap-1 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            收起详情
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            查看详情
          </>
        )}
      </button>
    </div>
  );
};
