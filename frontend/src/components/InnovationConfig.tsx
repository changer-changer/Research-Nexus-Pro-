import React from 'react';
import { Settings, Lightbulb, Layers, Clock, Target, Search, AlertCircle } from 'lucide-react';

interface InnovationConfigProps {
  config: {
    paradigms: string[];
    count: number;
    allowCrossDomain: boolean;
    useLatestMethods: boolean;
  };
  onConfigChange: (config: any) => void;
  onGenerate: () => void;
  loading: boolean;
  selectedPaperCount: number;
}

const PARADIGMS = [
  { id: 'CDT', name: '跨域迁移 (CDT)', icon: Target, desc: '领域A的方法应用于领域B的问题', color: 'blue' },
  { id: 'SHF', name: '结构洞填补 (SHF)', icon: Layers, desc: '结合解决同一问题的不同方法', color: 'green' },
  { id: 'MC', name: '方法组合 (MC)', icon: Settings, desc: '构建端到端Pipeline', color: 'purple' },
  { id: 'TF', name: '时间前沿 (TF)', icon: Clock, desc: '新方法解决经典难题', color: 'orange' },
  { id: 'CH', name: '反事实假设 (CH)', icon: AlertCircle, desc: '挑战领域默认假设', color: 'red' },
  { id: 'RGI', name: '研究缺口 (RGI)', icon: Search, desc: '高引用少解决的问题', color: 'teal' },
];

export const InnovationConfig: React.FC<InnovationConfigProps> = ({
  config,
  onConfigChange,
  onGenerate,
  loading,
  selectedPaperCount
}) => {
  const toggleParadigm = (paradigmId: string) => {
    const newParadigms = config.paradigms.includes(paradigmId)
      ? config.paradigms.filter(p => p !== paradigmId)
      : [...config.paradigms, paradigmId];
    onConfigChange({ ...config, paradigms: newParadigms });
  };

  const selectAll = () => {
    onConfigChange({ ...config, paradigms: PARADIGMS.map(p => p.id) });
  };

  const clearAll = () => {
    onConfigChange({ ...config, paradigms: [] });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          创新点生成配置
        </h2>
      </div>

      {/* 创新范式选择 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">选择创新范式</label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">全选</button>
            <span className="text-gray-300">|</span>
            <button onClick={clearAll} className="text-xs text-gray-600 hover:underline">清空</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PARADIGMS.map(paradigm => {
            const Icon = paradigm.icon;
            const isSelected = config.paradigms.includes(paradigm.id);
            const colorClasses: Record<string, string> = {
              blue: 'border-blue-200 bg-blue-50 text-blue-700',
              green: 'border-green-200 bg-green-50 text-green-700',
              purple: 'border-purple-200 bg-purple-50 text-purple-700',
              orange: 'border-orange-200 bg-orange-50 text-orange-700',
              red: 'border-red-200 bg-red-50 text-red-700',
              teal: 'border-teal-200 bg-teal-50 text-teal-700',
            };
            return (
              <div
                key={paradigm.id}
                onClick={() => toggleParadigm(paradigm.id)}
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? `${colorClasses[paradigm.color]} border-current`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isSelected ? 'currentColor' : 'text-gray-400'}`} />
                  <span className="font-medium text-sm">{paradigm.name}</span>
                </div>
                <p className={`text-xs mt-1 ${isSelected ? 'opacity-80' : 'text-gray-400'}`}>
                  {paradigm.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 生成数量 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          生成数量: {config.count} 个
        </label>
        <input
          type="range"
          min="1"
          max="20"
          value={config.count}
          onChange={(e) => onConfigChange({ ...config, count: parseInt(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      {/* 选项开关 */}
      <div className="space-y-3 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.allowCrossDomain}
            onChange={(e) => onConfigChange({ ...config, allowCrossDomain: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm">允许跨领域创新</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.useLatestMethods}
            onChange={(e) => onConfigChange({ ...config, useLatestMethods: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm">优先使用最新方法 (2025+)</span>
        </label>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={loading || selectedPaperCount === 0 || config.paradigms.length === 0}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            生成中...
          </span>
        ) : (
          `生成创新点 (${selectedPaperCount} 篇论文)`
        )}
      </button>

      {selectedPaperCount === 0 && (
        <p className="text-sm text-red-500 mt-2 text-center">请先选择论文</p>
      )}
      {config.paradigms.length === 0 && (
        <p className="text-sm text-red-500 mt-2 text-center">请至少选择一种创新范式</p>
      )}
    </div>
  );
};
