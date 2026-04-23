import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
  Download,
  Beaker,
  Clock,
  Cpu,
  Wrench,
  ClipboardList
} from 'lucide-react';

interface GuideStep {
  number: number;
  title: string;
  description: string;
  commands: string[];
  expected_output?: string;
  tips: string[];
  warnings: string[];
  checklist: string[];
}

interface ExperimentGuide {
  experiment_id: string;
  title: string;
  description: string;
  difficulty: string;
  estimated_time: string;
  prerequisites: string[];
  resources: {
    hardware: string[];
    software: string[];
    datasets: string[];
    libraries: string[];
  };
  safety_notes: string[];
  steps: GuideStep[];
  troubleshooting: Array<{
    problem: string;
    symptom: string;
    cause: string;
    solution: string;
  }>;
}

interface ExperimentGuideViewerProps {
  guide: ExperimentGuide;
  onComplete?: () => void;
  onDownload?: () => void;
}

export default function ExperimentGuideViewer({ guide, onComplete, onDownload }: ExperimentGuideViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const toggleStep = (stepNum: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  const toggleCheck = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCommand(cmd);
      setTimeout(() => setCopiedCommand(null), 2000);
    });
  };

  const progressPercent = Math.round((checkedItems.size / guide.steps.reduce((acc, s) => acc + s.checklist.length, 0)) * 100);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Beaker className="w-6 h-6 text-amber-600" />
              <h2 className="text-xl font-bold text-amber-900">{guide.title}</h2>
            </div>
            <p className="text-sm text-amber-700">{guide.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {guide.estimated_time}
              </span>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {guide.difficulty}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
              >
                <Download className="w-4 h-4" />
                Download Guide
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Checklist Progress</span>
          <span className="font-medium">{checkedItems.size} / {guide.steps.reduce((acc, s) => acc + s.checklist.length, 0)} items</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent || 5}%` }}
          />
        </div>
      </div>

      {/* Prerequisites */}
      {guide.prerequisites.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4" />
            Prerequisites (Do These First!)
          </h3>
          <ul className="space-y-2">
            {guide.prerequisites.map((pre, i) => (
              <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                {pre}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resources */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {guide.resources.hardware.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4" />
              Hardware
            </h4>
            <ul className="space-y-1">
              {guide.resources.hardware.map((item, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-gray-400">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {guide.resources.software.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4" />
              Software
            </h4>
            <ul className="space-y-1">
              {guide.resources.software.map((item, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-gray-400">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Step-by-Step Protocol
        </h3>
        {guide.steps.map((step) => {
          const isExpanded = expandedSteps.has(step.number);
          const stepChecks = step.checklist.map((_, i) => `step-${step.number}-${i}`);
          const stepProgress = stepChecks.filter(k => checkedItems.has(k)).length;

          return (
            <div key={step.number} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleStep(step.number)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {step.number}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                {step.checklist.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {stepProgress}/{step.checklist.length}
                  </span>
                )}
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* Description */}
                  <p className="text-sm text-gray-700">{step.description}</p>

                  {/* Commands */}
                  {step.commands.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commands</h4>
                      {step.commands.map((cmd, i) => (
                        <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-start gap-2 group">
                          <code className="text-xs text-green-400 font-mono flex-1 break-all">{cmd}</code>
                          <button
                            onClick={() => copyCommand(cmd)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Copy"
                          >
                            {copiedCommand === cmd ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expected Output */}
                  {step.expected_output && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-blue-700 mb-1">Expected Output</h4>
                      <p className="text-xs text-blue-600">{step.expected_output}</p>
                    </div>
                  )}

                  {/* Tips */}
                  {step.tips.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-emerald-600">💡 Tips</h4>
                      {step.tips.map((tip, i) => (
                        <p key={i} className="text-xs text-emerald-700 flex items-start gap-1">
                          <span>•</span>{tip}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {step.warnings.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-amber-600">⚠️ Warnings</h4>
                      {step.warnings.map((warn, i) => (
                        <p key={i} className="text-xs text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{warn}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Checklist */}
                  {step.checklist.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Checklist</h4>
                      {step.checklist.map((item, i) => {
                        const key = `step-${step.number}-${i}`;
                        const isChecked = checkedItems.has(key);
                        return (
                          <label key={i} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheck(key)}
                              className="mt-0.5 w-4 h-4 text-amber-600 rounded border-gray-300"
                            />
                            <span className={`text-sm ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {item}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Troubleshooting */}
      {guide.troubleshooting.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4" />
            Troubleshooting
          </h3>
          <div className="space-y-3">
            {guide.troubleshooting.map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-red-100">
                <div className="text-sm font-medium text-red-700">{item.problem}</div>
                <div className="text-xs text-gray-600 mt-1">Symptom: {item.symptom}</div>
                <div className="text-xs text-gray-600">Cause: {item.cause}</div>
                <div className="text-xs text-emerald-600 mt-1">✓ {item.solution}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Notes */}
      {guide.safety_notes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Safety Notes
          </h3>
          {guide.safety_notes.map((note, i) => (
            <p key={i} className="text-xs text-orange-700 flex items-start gap-1">
              <span className="mt-0.5">•</span>{note}
            </p>
          ))}
        </div>
      )}

      {/* Complete Button */}
      {onComplete && (
        <div className="flex justify-end">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            I've Completed the Experiments
          </button>
        </div>
      )}
    </div>
  );
}
