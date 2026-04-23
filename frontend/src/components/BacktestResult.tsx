import React from 'react';
import { TrendingUp, Target, CheckCircle, XCircle, Clock, BarChart3, History } from 'lucide-react';

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
  showHistory?: boolean;
  history?: BacktestResult[];
}

const PARADIGM_COLORS: Record<string, string> = {
  CDT: 'bg-blue-100 text-blue-700',
  SHF: 'bg-green-100 text-green-700',
  MC: 'bg-purple-100 text-purple-700',
  TF: 'bg-orange-100 text-orange-700',
  CH: 'bg-red-100 text-red-700',
  RGI: 'bg-teal-100 text-teal-700',
};

export const BacktestResultComponent: React.FC<BacktestResultProps> = ({
  result,
  showHistory = false,
  history = []
}) => {
  const hitRate = result.predicted_count > 0 
    ? (result.hit_count / result.predicted_count * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          回测验证结果
        </h2>
        <span className="text-sm text-gray-500">
          ID: {result.id}
        </span>
      </div>

      {/* 概览指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">预测创新点</div>
          <div className="text-2xl font-bold text-blue-800">{result.predicted_count}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="text-sm text-green-600 mb-1">命中真实论文</div>
          <div className="text-2xl font-bold text-green-800">{result.hit_count}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="text-sm text-purple-600 mb-1">命中率</div>
          <div className="text-2xl font-bold text-purple-800">{hitRate}%</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="text-sm text-orange-600 mb-1">F1值</div>
          <div className="text-2xl font-bold text-orange-800">{result.f1_score.toFixed(3)}</div>
        </div>
      </div>

      {/* 详细指标 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">评估指标</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">精确率 (Precision)</div>
            <div className="text-lg font-semibold">{result.precision.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">召回率 (Recall)</div>
            <div className="text-lg font-semibold">{result.recall.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">F1 Score</div>
            <div className="text-lg font-semibold">{result.f1_score.toFixed(3)}</div>
          </div>
        </div>
      </div>

      {/* 配置信息 */}
      <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          训练集: {result.train_years}
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          测试集: {result.test_year}
        </div>
        {result.domain && (
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 bg-gray-100 rounded">{result.domain}</span>
          </div>
        )}
      </div>

      {/* 详细匹配结果 */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">详细匹配</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {result.details.map((detail, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                detail.matched 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {detail.matched ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${PARADIGM_COLORS[detail.paradigm] || 'bg-gray-100'}`}>
                      {detail.paradigm}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{detail.predicted}</p>
                  {detail.matched && detail.matched_paper && (
                    <p className="text-xs text-green-600 mt-1">
                      匹配: {detail.matched_paper}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 历史记录 */}
      {showHistory && history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            历史回测记录
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">训练/测试</th>
                  <th className="px-3 py-2 text-center">预测</th>
                  <th className="px-3 py-2 text-center">命中</th>
                  <th className="px-3 py-2 text-center">精确率</th>
                  <th className="px-3 py-2 text-center">F1</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(h.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {h.train_years} → {h.test_year}
                    </td>
                    <td className="px-3 py-2 text-center">{h.predicted_count}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={h.hit_count > 0 ? 'text-green-600 font-medium' : ''}>
                        {h.hit_count}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{h.precision.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center font-medium">{h.f1_score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
