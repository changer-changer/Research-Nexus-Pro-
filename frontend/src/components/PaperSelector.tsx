import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckSquare, Square, BookOpen } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  year: number;
  domain: string;
  abstract?: string;
  citation_count?: number;
}

interface PaperSelectorProps {
  selectedPapers: string[];
  onSelectionChange: (paperIds: string[]) => void;
  maxSelection?: number;
}

export const PaperSelector: React.FC<PaperSelectorProps> = ({
  selectedPapers,
  onSelectionChange,
  maxSelection = 20
}) => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    domain: '',
    yearStart: 2020,
    yearEnd: 2026,
    keywords: ''
  });

  const domains = ['全部', '触觉模仿学习', 'VLA', '多智能体', '机器人', 'AI智能体'];

  useEffect(() => {
    fetchPapers();
  }, [filters]);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.domain && filters.domain !== '全部') {
        params.append('domain', filters.domain);
      }
      params.append('year_start', filters.yearStart.toString());
      params.append('year_end', filters.yearEnd.toString());
      if (filters.keywords) {
        params.append('keywords', filters.keywords);
      }
      params.append('limit', '50');

      const response = await fetch(`/api/innovation/papers/list?${params}`);
      const data = await response.json();
      setPapers(data);
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    }
    setLoading(false);
  };

  const togglePaper = (paperId: string) => {
    if (selectedPapers.includes(paperId)) {
      onSelectionChange(selectedPapers.filter(id => id !== paperId));
    } else if (selectedPapers.length < maxSelection) {
      onSelectionChange([...selectedPapers, paperId]);
    }
  };

  const selectAll = () => {
    const availableSlots = maxSelection - selectedPapers.length;
    const papersToAdd = papers
      .filter(p => !selectedPapers.includes(p.id))
      .slice(0, availableSlots)
      .map(p => p.id);
    onSelectionChange([...selectedPapers, ...papersToAdd]);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          论文选择器
        </h2>
        <span className="text-sm text-gray-500">
          已选 {selectedPapers.length}/{maxSelection} 篇
        </span>
      </div>

      {/* 筛选器 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">领域</label>
          <select
            value={filters.domain}
            onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          >
            {domains.map(d => <option key={d} value={d === '全部' ? '' : d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">起始年份</label>
          <input
            type="number"
            value={filters.yearStart}
            onChange={(e) => setFilters({ ...filters, yearStart: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束年份</label>
          <input
            type="number"
            value={filters.yearEnd}
            onChange={(e) => setFilters({ ...filters, yearEnd: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.keywords}
              onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
              placeholder="搜索..."
              className="w-full pl-9 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={selectAll}
          disabled={selectedPapers.length >= maxSelection}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50"
        >
          全选
        </button>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          清空
        </button>
      </div>

      {/* 论文列表 */}
      <div className="border rounded-md max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : papers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无论文</div>
        ) : (
          papers.map(paper => (
            <div
              key={paper.id}
              onClick={() => togglePaper(paper.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 flex items-start gap-3 ${
                selectedPapers.includes(paper.id) ? 'bg-blue-50' : ''
              }`}
            >
              {selectedPapers.includes(paper.id) ? (
                <CheckSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{paper.title}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>{paper.year}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{paper.domain}</span>
                  {paper.citation_count !== undefined && (
                    <span>引用: {paper.citation_count}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
