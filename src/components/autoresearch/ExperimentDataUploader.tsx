import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  Image,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Save,
  Table,
  BarChart3,
  Type,
  RotateCcw,
} from 'lucide-react';

interface ExperimentData {
  metrics: Record<string, number>;
  tables: Array<Record<string, any>>;
  figures: string[];
  notes: string;
}

interface ExperimentDataUploaderProps {
  taskId: string;
  slotId?: string;
  onSubmit?: (data: ExperimentData) => void;
  onCancel?: () => void;
}

export default function ExperimentDataUploader({
  taskId,
  slotId = 'exp_001',
  onSubmit,
  onCancel,
}: ExperimentDataUploaderProps) {
  const [metrics, setMetrics] = useState<Array<{ key: string; value: string }>>([
    { key: 'accuracy', value: '' },
    { key: 'f1_score', value: '' },
  ]);
  const [tables, setTables] = useState<Array<{ name: string; rows: Array<Record<string, any>> }>>([]);
  const [figures, setFigures] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: string; size: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'tables' | 'figures' | 'notes'>('metrics');

  const addMetric = () => setMetrics([...metrics, { key: '', value: '' }]);
  const removeMetric = (idx: number) => setMetrics(metrics.filter((_, i) => i !== idx));
  const updateMetric = (idx: number, field: 'key' | 'value', val: string) => {
    const next = [...metrics];
    next[idx][field] = val;
    setMetrics(next);
  };

  const addTable = () => {
    setTables([...tables, { name: `Table ${tables.length + 1}`, rows: [{ col1: '' }] }]);
  };
  const removeTable = (idx: number) => setTables(tables.filter((_, i) => i !== idx));

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setParseError(null);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    []
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, []);

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        setUploadedFiles((prev) => [...prev, { name: file.name, type: file.type, size: file.size }]);

        if (file.name.endsWith('.csv')) {
          try {
            const lines = text.split('\n').filter((l) => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].split(',').map((h) => h.trim());
            const rows = lines.slice(1).map((line) => {
              const cells = line.split(',').map((c) => c.trim());
              const row: Record<string, any> = {};
              headers.forEach((h, i) => {
                const v = cells[i];
                row[h] = isNaN(Number(v)) ? v : Number(v);
              });
              return row;
            });
            setTables((prev) => [...prev, { name: file.name.replace('.csv', ''), rows }]);
          } catch (err) {
            setParseError(`Failed to parse ${file.name}: ${err}`);
          }
        } else if (file.name.endsWith('.json')) {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              setTables((prev) => [...prev, { name: file.name.replace('.json', ''), rows: data }]);
            } else if (typeof data === 'object' && data !== null) {
              // Try to extract metrics from flat object
              const newMetrics = Object.entries(data).map(([k, v]) => ({
                key: k,
                value: String(v),
              }));
              setMetrics((prev) => [...prev, ...newMetrics]);
            }
          } catch (err) {
            setParseError(`Failed to parse ${file.name}: ${err}`);
          }
        }
      };
      reader.readAsText(file);
    });
  };

  const buildData = (): ExperimentData => {
    const metricMap: Record<string, number> = {};
    metrics.forEach((m) => {
      if (m.key.trim()) {
        const val = parseFloat(m.value);
        if (!isNaN(val)) metricMap[m.key.trim()] = val;
      }
    });
    return {
      metrics: metricMap,
      tables: tables.map((t) => ({ table_name: t.name, data: t.rows })),
      figures,
      notes,
    };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      const data = buildData();
      const response = await fetch(
        `/api/v3/paper-tasks/${taskId}/experiments/${slotId}/data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      setSubmitStatus('success');
      onSubmit?.(data);
    } catch (err: any) {
      setSubmitStatus('error');
      setParseError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'metrics' as const, label: 'Metrics', icon: BarChart3 },
    { id: 'tables' as const, label: 'Tables', icon: Table },
    { id: 'figures' as const, label: 'Figures', icon: Image },
    { id: 'notes' as const, label: 'Notes', icon: Type },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-900">Upload Experiment Results</h2>
            </div>
            <p className="text-sm text-blue-700">
              Inject your experiment data to auto-complete the paper. Supported formats: CSV, JSON, or manual entry.
            </p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* File Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop CSV or JSON files here, or{' '}
          <label className="text-blue-600 cursor-pointer hover:underline">
            browse
            <input type="file" accept=".csv,.json" multiple className="hidden" onChange={handleFileSelect} />
          </label>
        </p>
        <p className="text-xs text-gray-400">CSV files become tables. JSON flat objects become metrics.</p>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs"
            >
              {f.name.endsWith('.csv') ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileJson className="w-3.5 h-3.5" />}
              {f.name}
              <button
                onClick={() => setUploadedFiles(uploadedFiles.filter((_, j) => j !== i))}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{parseError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Key Metrics</h4>
                <button
                  onClick={addMetric}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Metric
                </button>
              </div>
              {metrics.length === 0 && (
                <p className="text-sm text-gray-400 italic">No metrics yet. Add one or upload a JSON file.</p>
              )}
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={m.key}
                    onChange={(e) => updateMetric(i, 'key', e.target.value)}
                    placeholder="Metric name (e.g. accuracy)"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={m.value}
                    onChange={(e) => updateMetric(i, 'value', e.target.value)}
                    placeholder="0.95"
                    className="w-32 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button onClick={() => removeMetric(i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Data Tables</h4>
                <button
                  onClick={addTable}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Table
                </button>
              </div>
              {tables.length === 0 && (
                <p className="text-sm text-gray-400 italic">No tables yet. Upload a CSV or add manually.</p>
              )}
              {tables.map((table, ti) => (
                <div key={ti} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={table.name}
                      onChange={(e) => {
                        const next = [...tables];
                        next[ti].name = e.target.value;
                        setTables(next);
                      }}
                      className="font-medium text-sm border-none bg-transparent focus:ring-0 p-0"
                    />
                    <button onClick={() => removeTable(ti)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {table.rows.length} rows × {Object.keys(table.rows[0] || {}).length} columns
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Figures Tab */}
          {activeTab === 'figures' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Paste figure URLs or base64 data URIs. These will be embedded in the paper.
              </p>
              <textarea
                value={figures.join('\n')}
                onChange={(e) => setFigures(e.target.value.split('\n').filter((f) => f.trim()))}
                placeholder="https://example.com/figure1.png&#10;data:image/png;base64,..."
                className="w-full h-32 px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400">One figure per line. {figures.length} figure(s) added.</p>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Additional notes about the experiment setup, observations, or anything the AI should know when writing the results section.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="We trained for 100 epochs with batch size 32. The learning rate was set to 1e-4..."
                className="w-full h-40 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Data Preview */}
      {Object.keys(buildData().metrics).length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Data Preview</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(buildData().metrics).map(([k, v]) => (
              <div key={k} className="bg-white border rounded p-2">
                <div className="text-xs text-gray-500 truncate">{k}</div>
                <div className="text-sm font-mono font-medium text-gray-800">{v}</div>
              </div>
            ))}
          </div>
          {tables.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              + {tables.length} table(s) with {tables.reduce((a, t) => a + t.rows.length, 0)} total rows
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Task: <span className="font-mono text-gray-700">{taskId}</span>
          {slotId !== 'exp_001' && (
            <span className="ml-2">
              Slot: <span className="font-mono text-gray-700">{slotId}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {isSubmitting ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : submitStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? 'Injecting...' : submitStatus === 'success' ? 'Data Injected!' : 'Inject into Paper'}
          </button>
        </div>
      </div>

      {submitStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">Data successfully injected!</p>
            <p className="text-xs text-green-600 mt-1">
              The paper has been updated with your experiment results. Check the preview to see the changes.
            </p>
          </div>
        </div>
      )}

      {submitStatus === 'error' && parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Failed to inject data</p>
            <p className="text-xs text-red-600 mt-1">{parseError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
