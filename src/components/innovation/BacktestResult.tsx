/**
 * Backtest Result Component
 * 回测结果展示组件
 */

import React from 'react';
import { Target, CheckCircle, XCircle, BarChart3, TrendingUp, Percent } from 'lucide-react';

interface BacktestDetail {
  predicted: string;
  paradigm: string;
  matched: boolean;
  matched_paper?: string;
  matched_paper_id?: string;
}

interface BacktestResult {
  id: string;
  train_years: string;
  test_year: number;
  domain?: string;
  predicted_count: number;
  hit_count: number;
  precision: number;
  recall: number;
  f1_score: number;
  details: BacktestDetail[];
  created_at: string;
}

interface BacktestResultProps {
  result: BacktestResult;
}

const PARADIGM_COLORS: Record<string, string> = {
  CDT: 'text-purple-600 bg-purple-50',
  SHF: 'text-blue-600 bg-blue-50',
  MC: 'text-green-600 bg-green-50',
  TF: 'text-orange-600 bg-orange-50',
  CH: 'text-red-600 bg-red-50',
  RGI: 'text-teal-600 bg-teal-50',
};

export const BacktestResultComponent: React.FC<BacktestResultProps> = ({ result }) => {
  const hitRate = result.hit_count / result.predicted_count;
  
  const getRating = (score: number) => {
    if (score >= 0.8) return { text: '优秀', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 0.6) return { text: '良好', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 0.4) return { text: '一般', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: '需改进', color: 'text-red-600', bg: 'bg-red-100' };
  };
  
  const f1Rating = getRating(result.f1_score);
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6" />
            <h2 className="text-xl font-bold">回测验证结果</h2>
          </div>
          <div className="text-sm opacity-80">
            {result.train_years} → {result.test_year}
            {result.domain && ` | ${result.domain}`}
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* 命中率 */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {(hitRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">命中率</div>
            <div className="text-xs text-gray-400">
              {result.hit_count}/{result.predicted_count}
            </div>
          </div>
          
          {/* 精确率 */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {(result.precision * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">精确率</div>
            <div className="text-xs text-gray-400">Precision</div>
          </div>
          
          {/* 召回率 */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">
              {(result.recall * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">召回率</div>
            <div className="text-xs text-gray-400">Recall</div>
          </div>
          
          {/* F1值 */}
          <div className={`rounded-xl p-4 text-center ${f1Rating.bg}`}>
            <div className={`text-3xl font-bold ${f1Rating.color}`}>
              {result.f1_score.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600 mt-1">F1值</div>
            <div className={`text-xs font-medium ${f1Rating.color}`}>
              {f1Rating.text}
            </div>
          </div>
        </div>
        
        {/* 详细匹配列表 */}
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-gray-700">
              详细匹配情况
            </span>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                命中: {result.hit_count}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="w-4 h-4" />
                未命中: {result.predicted_count - result.hit_count}
              </span>
            </div>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {result.details.map((detail, idx) => (
              <div
                key={idx}
                className={`px-4 py-3 border-b last:border-b-0 flex items-start gap-3 ${
                  detail.matched ? 'bg-green-50' : ''
                }`}
              >
                {/* 状态图标 */}
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
                  detail.matched 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {detail.matched ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* 预测内容 */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      PARADIGM_COLORS[detail.paradigm] || 'text-gray-600 bg-gray-100'
                    }`}>
                      {detail.paradigm}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {detail.predicted}
                    </span>
                  </div>
                  
                  {/* 匹配结果 */}
                  {detail.matched && detail.matched_paper && (
                    <div className="mt-1 text-sm">
                      <span className="text-green-600 font-medium">→ 命中: </span>
                      <span className="text-gray-600">{detail.matched_paper}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* 结论 */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">回测结论</span>
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">
            基于 {result.train_years} 年的训练数据，系统预测了 {result.predicted_count} 个创新点，
            其中 {result.hit_count} 个在 {result.test_year} 年的真实论文中得到验证，
            命中率为 {(hitRate * 100).toFixed(1)}%。F1值为 {result.f1_score.toFixed(2)}，
            整体表现{f1Rating.text}。这表明系统能够有效预测未来研究方向。
          </p>
        </div>
      </div>
      
      {/* 底部信息 */}
      <div className="bg-gray-50 px-6 py-3 text-xs text-gray-400 text-center">
        回测ID: {result.id} | 生成时间: {new Date(result.created_at).toLocaleString()}
      </div>
    </div>
  );
};
