import React from 'react';
import { Lightbulb, Target, Layers, Settings, Clock, AlertCircle, Search, Star, TrendingUp, CheckCircle, FlaskConical } from 'lucide-react';

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
  urgency_score: number;
  composite_score: number;
  mvp_experiment?: string;
  created_at: string;
}

interface InnovationCardProps {
  innovation: Innovation;
  onClick?: () => void;
  expanded?: boolean;
}

const PARADIGM_INFO: Record<string, { name: string; icon: any; color: string; bgColor: string }> = {
  CDT: { name: '跨域迁移', icon: Target, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  SHF: { name: '结构洞填补', icon: Layers, color: 'text-green-600', bgColor: 'bg-green-50' },
  MC: { name: '方法组合', icon: Settings, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  TF: { name: '时间前沿', icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  CH: { name: '反事实假设', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  RGI: { name: '研究缺口', icon: Search, color: 'text-teal-600', bgColor: 'bg-teal-50' },
};

export const InnovationCard: React.FC<InnovationCardProps> = ({
  innovation,
  onClick,
  expanded = false
}) => {
  const paradigm = PARADIGM_INFO[innovation.paradigm] || PARADIGM_INFO.CDT;
  const Icon = paradigm.icon;

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600 bg-green-50';
    if (score >= 3.5) return 'text-blue-600 bg-blue-50';
    if (score >= 2.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
        expanded ? 'border-2 border-blue-200' : ''
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 ${paradigm.bgColor} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${paradigm.color}`} />
            <span className={`text-xs font-semibold px-2 py-1 rounded ${paradigm.bgColor} ${paradigm.color}`}>
              {paradigm.name}
            </span>
          </div>
          <div className={`text-sm font-bold px-2 py-1 rounded ${getScoreColor(innovation.composite_score)}`}>
            综合: {innovation.composite_score.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 text-gray-900">{innovation.title}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{innovation.description}</p>

        {/* Scores */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">新颖性</div>
            <div className={`text-sm font-semibold px-1.5 py-0.5 rounded ${getScoreColor(innovation.novelty_score)}`}>
              {innovation.novelty_score.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">可行性</div>
            <div className={`text-sm font-semibold px-1.5 py-0.5 rounded ${getScoreColor(innovation.feasibility_score)}`}>
              {innovation.feasibility_score.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">影响力</div>
            <div className={`text-sm font-semibold px-1.5 py-0.5 rounded ${getScoreColor(innovation.impact_score)}`}>
              {innovation.impact_score.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">时效性</div>
            <div className={`text-sm font-semibold px-1.5 py-0.5 rounded ${getScoreColor(innovation.urgency_score)}`}>
              {innovation.urgency_score.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Target className="w-3 h-3" /> 目标问题
              </h4>
              <p className="text-sm text-gray-600 mt-1">{innovation.target_problem}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> 候选方法
              </h4>
              <p className="text-sm text-gray-600 mt-1">{innovation.candidate_method}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Star className="w-3 h-3" /> 核心洞察
              </h4>
              <p className="text-sm text-gray-600 mt-1">{innovation.core_insight}</p>
            </div>
            {innovation.mvp_experiment && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                  <FlaskConical className="w-3 h-3" /> MVP实验建议
                </h4>
                <p className="text-sm text-gray-600 mt-1">{innovation.mvp_experiment}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-700">源论文</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {innovation.source_papers.map((paper, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {paper}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!expanded && (
          <div className="text-xs text-gray-400 text-center mt-2">
            点击展开详情
          </div>
        )}
      </div>
    </div>
  );
};
