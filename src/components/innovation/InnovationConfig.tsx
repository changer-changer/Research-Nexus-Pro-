/**
 * Innovation Config Panel
 * 创新点生成配置面板
 */

import React from 'react';
import { Settings, Lightbulb } from 'lucide-react';

interface InnovationConfigProps {
  paradigms: string[];
  setParadigms: (paradigms: string[]) => void;
  count: number;
  setCount: (count: number) => void;
  onGenerate: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const PARADIGM_OPTIONS = [
  { id: 'CDT', name: 'CDT - 跨域迁移', desc: '领域A方法应用于领域B问题', color: 'bg-purple-100 text-purple-800' },
  { id: 'SHF', name: 'SHF - 结构洞填补', desc: '组合解决同一问题的不同方法', color: 'bg-blue-100 text-blue-800' },
  { id: 'MC', name: 'MC - 方法组合', desc: '构建端到端Pipeline', color: 'bg-green-100 text-green-800' },
  { id: 'TF', name: 'TF - 时间前沿', desc: '最新方法解决经典难题', color: 'bg-orange-100 text-orange-800' },
  { id: 'CH', name: 'CH - 反事实假设', desc: '挑战默认假设寻找新解', color: 'bg-red-100 text-red-800' },
  { id: 'RGI', name: 'RGI - 研究缺口', desc: '识别高引用低解决方案领域', color: 'bg-teal-100 text-teal-800' },
];

export const InnovationConfig: React.FC<InnovationConfigProps> = ({
  paradigms,
  setParadigms,
  count,
  setCount,
  onGenerate,
  loading = false,
  disabled = false
}) => {
  const toggleParadigm = (id: string) => {
    if (paradigms.includes(id)) {
      setParadigms(paradigms.filter(p => p !== id));
    } else {
      setParadigms([...paradigms, id]);
    }
  };

  const selectAll = () => {
    setParadigms(PARADIGM_OPTIONS.map(p => p.id));
  };

  const clearAll = () => {
    setParadigms([]);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">创新点生成配置</h2>
      </div>

      {/* 创新范式选择 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="font-semibold text-gray-700">
            创新范式选择
          </label>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              全选
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              清空
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PARADIGM_OPTIONS.map(option => (
            <div
              key={option.id}
              onClick={() => toggleParadigm(option.id)}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                paradigms.includes(option.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${
                  paradigms.includes(option.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                }`}>
                  {paradigms.includes(option.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${option.color}`}>
                      {option.id}
                    </span>
                    <span className="font-medium text-gray-900">
                      {option.name.split(' - ')[1]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {paradigms.length === 0 && (
          <p className="text-sm text-red-500 mt-2">
            ⚠️ 请至少选择一种创新范式
          </p>
        )}
      </div>

      {/* 生成数量 */}
      <div className="mb-6">
        <label className="block font-semibold text-gray-700 mb-2">
          生成数量: <span className="text-blue-600">{count}</span> 个
        </label>
        <input
          type="range"
          min="3"
          max="15"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>3个</span>
          <span>15个</span>
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={disabled || loading || paradigms.length === 0}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            正在生成创新点...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Lightbulb className="w-5 h-5" />
            生成创新点 ({paradigms.length}种范式 × {count}个)
          </span>
        )}
      </button>
    </div>
  );
};
