/**
 * Paper Selector Component
 * 论文选择器 - 支持按领域/年份/关键词筛选
 */

import React, { useState, useEffect } from 'react';
import { Search, Filter, Check, X } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  year: number;
  domain: string;
  abstract?: string;
  citation_count?: number;
}

interface PaperSelectorProps {
  onSelect: (selectedPapers: Paper[]) => void;
  initialSelected?: string[];
}

export const PaperSelector: React.FC<PaperSelectorProps> = ({ 
  onSelect,
  initialSelected = []
}) => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [loading, setLoading] = useState(false);
  
  // 筛选条件
  const [domain, setDomain] = useState('');
  const [yearStart, setYearStart] = useState(2020);
  const [yearEnd, setYearEnd] = useState(2026);
  const [keywords, setKeywords] = useState('');
  
  // 领域选项
  const domains = ['', '触觉模仿学习', 'VLA', '多智能体协作', 'LLM工具', '智能体记忆'];
  
  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (domain) params.append('domain', domain);
      if (yearStart) params.append('year_start', yearStart.toString());
      if (yearEnd) params.append('year_end', yearEnd.toString());
      if (keywords) params.append('keywords', keywords);
      params.append('limit', '50');
      
      const response = await fetch(`/api/innovation/papers/list?${params}`);
      const data = await response.json();
      setPapers(data);
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchPapers();
  }, []);
  
  const toggleSelection = (paperId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(paperId)) {
      newSelected.delete(paperId);
    } else {
      newSelected.add(paperId);
    }
    setSelected(newSelected);
  };
  
  const selectAll = () => {
    setSelected(new Set(papers.map(p => p.id)));
  };
  
  const clearSelection = () => {
    setSelected(new Set());
  };
  
  const confirmSelection = () => {
    const selectedPapers = papers.filter(p => selected.has(p.id));
    onSelect(selectedPapers);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">论文选择器</h2>
        <span className="text-sm text-gray-500">
          已选 {selected.size} 篇论文
        </span>
      </div>
      
      {/* 筛选面板 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-700">筛选条件</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 领域选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              领域
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {domains.map(d => (
                <option key={d} value={d}>{d || '全部'}</option>
              ))}
            </select>
          </div>
          
          {/* 年份范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              起始年份
            </label>
            <input
              type="number"
              value={yearStart}
              onChange={(e) => setYearStart(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束年份
            </label>
            <input
              type="number"
              value={yearEnd}
              onChange={(e) => setYearEnd(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 关键词搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="搜索标题/摘要..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={fetchPapers}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 论文列表 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
          <span className="font-semibold text-gray-700">
            论文列表 ({papers.length}篇)
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              全选
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              清空
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              加载中...
            </div>
          ) : papers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无符合条件的论文
            </div>
          ) : (
            papers.map(paper => (
              <div
                key={paper.id}
                onClick={() => toggleSelection(paper.id)}
                className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 flex items-start gap-3 ${
                  selected.has(paper.id) ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${
                  selected.has(paper.id) 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'border-gray-300'
                }`}>
                  {selected.has(paper.id) && <Check className="w-3 h-3 text-white" />}
                </div>
                
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {paper.title}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-gray-500">
                    <span>{paper.year}年</span>
                    <span>{paper.domain}</span>
                    {paper.citation_count && (
                      <span>引用: {paper.citation_count}</span>
                    )}
                  </div>
                  {paper.abstract && (
                    <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {paper.abstract}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 已选论文预览 */}
      {selected.size > 0 && (
        <div className="mt-4 bg-blue-50 rounded-lg p-4">
          <div className="font-semibold text-blue-900 mb-2">
            已选论文预览 ({selected.size}篇)
          </div>
          <div className="space-y-1 text-sm text-blue-800">
            {papers
              .filter(p => selected.has(p.id))
              .slice(0, 5)
              .map(p => (
                <div key={p.id} className="truncate">• {p.title}</div>
              ))}
            {selected.size > 5 && (
              <div className="text-blue-600">
                ... 还有 {selected.size - 5} 篇
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 操作按钮 */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={clearSelection}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onClick={confirmSelection}
          disabled={selected.size === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          确认选择 ({selected.size}篇)
        </button>
      </div>
    </div>
  );
};
