import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Beaker, CheckCircle, AlertCircle, Clock, Package,
  Monitor, Database, FileText, AlertTriangle, ChevronDown,
  ChevronUp, Download, Copy, Check, Play, Pause, RotateCcw,
  Lightbulb, Wrench, BookOpen, ClipboardList, Save
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

interface ExperimentStep {
  id: string;
  number: number;
  title: string;
  duration: string; // e.g., "3-5 minutes"
  description: string;
  detailedInstructions: string[];
  expectedOutcome: string;
  checkpoints: string[];
  materials: string[];
  screenshots?: string[]; // URLs to example screenshots
  commonMistakes: string[];
  troubleshooting: { problem: string; solution: string }[];
}

interface Prerequisite {
  id: string;
  category: string;
  items: {
    name: string;
    description: string;
    check: boolean;
    resources?: string[];
  }[];
}

interface HardwareRequirement {
  name: string;
  specs: string;
  purpose: string;
  alternatives?: string[];
  estimatedCost?: string;
}

interface SoftwareRequirement {
  name: string;
  version: string;
  purpose: string;
  installCommand?: string;
  checkCommand?: string;
}

interface DatasetInfo {
  name: string;
  size: string;
  format: string;
  source: string;
  downloadUrl?: string;
  preprocessing?: string[];
}

interface ExpectedResult {
  metric: string;
  baselineValue: string;
  targetValue: string;
  tolerance: string;
  interpretation: string;
}

interface ExperimentGuide {
  id: string;
  title: string;
  objective: string;
  estimatedTotalTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: Prerequisite[];
  hardware: HardwareRequirement[];
  software: SoftwareRequirement[];
  datasets: DatasetInfo[];
  steps: ExperimentStep[];
  expectedResults: ExpectedResult[];
  resultTemplate: {
    sections: {
      title: string;
      fields: { name: string; type: 'text' | 'number' | 'file' | 'table'; placeholder?: string }[];
    }[];
  };
}

// Mock experiment guide data
const MOCK_GUIDE: ExperimentGuide = {
  id: 'exp-001',
  title: 'Multi-Agent Memory System Evaluation',
  objective: 'Evaluate the effectiveness of externalized memory architecture in long-context understanding tasks',
  estimatedTotalTime: '4-6 hours',
  difficulty: 'intermediate',
  prerequisites: [
    {
      id: 'knowledge',
      category: 'Required Knowledge',
      items: [
        { name: 'Python Programming', description: 'Basic Python syntax and data structures', check: false, resources: ['https://docs.python.org/3/tutorial/'] },
        { name: 'PyTorch Basics', description: 'Understanding of tensors, models, and training loops', check: false, resources: ['https://pytorch.org/tutorials/'] },
        { name: 'Transformer Architecture', description: 'Familiarity with attention mechanisms and LLMs', check: false, resources: ['https://arxiv.org/abs/1706.03762'] },
        { name: 'Docker Basics', description: 'Container management and deployment', check: false, resources: ['https://docs.docker.com/get-started/'] }
      ]
    },
    {
      id: 'skills',
      category: 'Required Skills',
      items: [
        { name: 'Git Version Control', description: 'Clone repos, create branches, commit changes', check: false },
        { name: 'Linux Command Line', description: 'Navigate filesystem, run scripts, manage processes', check: false },
        { name: 'Jupyter Notebooks', description: 'Create and run interactive experiments', check: false }
      ]
    }
  ],
  hardware: [
    {
      name: 'GPU Server',
      specs: 'NVIDIA A100 40GB or RTX 3090 24GB',
      purpose: 'Model training and inference',
      alternatives: ['AWS p3.2xlarge', 'Google Cloud T4', 'Lambda GPU Cloud'],
      estimatedCost: '$2-5/hour'
    },
    {
      name: 'Storage',
      specs: '100GB+ SSD space',
      purpose: 'Dataset storage and model checkpoints',
      alternatives: ['External SSD', 'Network storage']
    },
    {
      name: 'RAM',
      specs: '32GB+',
      purpose: 'Data loading and preprocessing',
      alternatives: ['Swap space', 'Memory-efficient loading']
    }
  ],
  software: [
    {
      name: 'Python',
      version: '3.9+',
      purpose: 'Main programming language',
      installCommand: 'conda create -n exp python=3.9',
      checkCommand: 'python --version'
    },
    {
      name: 'PyTorch',
      version: '2.0+',
      purpose: 'Deep learning framework',
      installCommand: 'pip install torch torchvision',
      checkCommand: 'python -c "import torch; print(torch.__version__)"'
    },
    {
      name: 'CUDA',
      version: '11.8+',
      purpose: 'GPU acceleration',
      installCommand: 'See NVIDIA documentation',
      checkCommand: 'nvidia-smi'
    },
    {
      name: 'Transformers',
      version: '4.30+',
      purpose: 'Pre-trained models',
      installCommand: 'pip install transformers',
      checkCommand: 'python -c "import transformers; print(transformers.__version__)"'
    },
    {
      name: 'Weights & Biases',
      version: 'latest',
      purpose: 'Experiment tracking',
      installCommand: 'pip install wandb',
      checkCommand: 'wandb --version'
    }
  ],
  datasets: [
    {
      name: 'NarrativeQA',
      size: '2.5GB',
      format: 'JSON',
      source: 'HuggingFace Datasets',
      downloadUrl: 'https://huggingface.co/datasets/narrativeqa',
      preprocessing: ['Tokenization', 'Chunking into 4K/8K/16K segments', 'QA pair extraction']
    },
    {
      name: 'SCROLLS',
      size: '1.8GB',
      format: 'JSONL',
      source: 'HuggingFace Datasets',
      downloadUrl: 'https://huggingface.co/datasets/scrolls',
      preprocessing: ['Document filtering', 'Summarization prompt creation']
    }
  ],
  steps: [
    {
      id: 'step1',
      number: 1,
      title: 'Environment Setup',
      duration: '10-15 minutes',
      description: 'Create isolated environment and install dependencies',
      detailedInstructions: [
        'Open terminal and navigate to your workspace',
        'Create conda environment: conda create -n multi-agent-exp python=3.9',
        'Activate environment: conda activate multi-agent-exp',
        'Clone repository: git clone https://github.com/your-org/multi-agent-memory',
        'Install requirements: pip install -r requirements.txt',
        'Verify GPU access: python -c "import torch; print(torch.cuda.is_available())"',
        'Should print: True (if GPU is available)'
      ],
      expectedOutcome: 'Environment activated, all packages installed, GPU accessible',
      checkpoints: ['conda env list shows multi-agent-exp', 'pip list shows torch, transformers', 'GPU check returns True'],
      materials: ['Terminal access', 'Conda installed', 'Git configured'],
      commonMistakes: [
        'Forgetting to activate conda environment before installing packages',
        'Installing PyTorch CPU version instead of CUDA version',
        'Insufficient disk space for model downloads'
      ],
      troubleshooting: [
        { problem: 'CUDA out of memory', solution: 'Close other GPU processes or reduce batch size' },
        { problem: 'Package conflicts', solution: 'Create fresh environment and install packages in order' }
      ]
    },
    {
      id: 'step2',
      number: 2,
      title: 'Data Preparation',
      duration: '20-30 minutes',
      description: 'Download and preprocess datasets for evaluation',
      detailedInstructions: [
        'Create data directory: mkdir -p data/raw data/processed',
        'Download NarrativeQA: python scripts/download_narrativeqa.py',
        'Verify download: ls -lh data/raw/narrativeqa/ (should show ~2.5GB)',
        'Run preprocessing: python scripts/preprocess.py --dataset narrativeqa',
        'Check output: ls data/processed/narrativeqa/ (should show train/val/test splits)',
        'Download SCROLLS dataset (same process)',
        'Verify both datasets are ready'
      ],
      expectedOutcome: 'Both datasets downloaded, preprocessed, and ready for training',
      checkpoints: ['data/processed/ contains processed files', 'Can load a sample with python scripts/test_data.py'],
      materials: ['10GB+ free disk space', 'Stable internet connection'],
      commonMistakes: [
        'Interrupted downloads (use wget -c for resume)',
        'Wrong data format after preprocessing',
        'Missing validation set'
      ],
      troubleshooting: [
        { problem: 'Download fails', solution: 'Use HuggingFace cache or manual download' },
        { problem: 'Preprocessing OOM', solution: 'Process in smaller chunks with --chunk-size flag' }
      ]
    },
    {
      id: 'step3',
      number: 3,
      title: 'Baseline Implementation',
      duration: '45-60 minutes',
      description: 'Implement baseline model for comparison',
      detailedInstructions: [
        'Open src/baseline_model.py in your editor',
        'Review the TransformerEncoder class structure',
        'Implement forward pass with standard attention',
        'Set max sequence length to 4096 tokens',
        'Run unit test: pytest tests/test_baseline.py -v',
        'All tests should pass (green checkmarks)',
        'Document any modifications in NOTES.md'
      ],
      expectedOutcome: 'Baseline model passes all unit tests',
      checkpoints: ['pytest shows 5/5 tests passed', 'Can instantiate model without errors', 'Forward pass produces correct output shape'],
      materials: ['Code editor', 'PyTorch documentation'],
      commonMistakes: [
        'Wrong attention mask shape',
        'Forgetting positional encodings',
        'Incorrect padding handling'
      ],
      troubleshooting: [
        { problem: 'Test failures', solution: 'Check tensor shapes match expected dimensions' },
        { problem: 'Import errors', solution: 'Ensure __init__.py files exist in all modules' }
      ]
    },
    {
      id: 'step4',
      number: 4,
      title: 'Multi-Agent Memory System',
      duration: '60-90 minutes',
      description: 'Implement the externalized memory architecture',
      detailedInstructions: [
        'Open src/memory_system.py',
        'Implement MemoryAgent class with store/retrieve methods',
        'Create agent coordinator for communication',
        'Implement memory eviction policy (LRU)',
        'Add memory consistency checks',
        'Write integration tests',
        'Run: pytest tests/test_memory_system.py -v',
        'Profile memory usage: python scripts/profile_memory.py'
      ],
      expectedOutcome: 'Memory system operational, tests passing, memory overhead measured',
      checkpoints: ['MemoryAgent can store and retrieve', 'Multiple agents can communicate', 'Memory usage is bounded'],
      materials: ['System design document', 'Algorithm pseudocode'],
      commonMistakes: [
        'Memory leaks (not freeing unused memory)',
        'Race conditions in multi-agent access',
        'Inconsistent memory state'
      ],
      troubleshooting: [
        { problem: 'Agents deadlock', solution: 'Add timeouts and retry logic' },
        { problem: 'Memory grows unbounded', solution: 'Implement stricter eviction policy' }
      ]
    },
    {
      id: 'step5',
      number: 5,
      title: 'Training Setup',
      duration: '20-30 minutes',
      description: 'Configure training parameters and launch jobs',
      detailedInstructions: [
        'Copy config template: cp configs/template.yaml configs/experiment.yaml',
        'Edit learning rate: 1e-4, batch size based on GPU memory',
        'Set max epochs: 10 with early stopping',
        'Configure W&B logging: wandb login (enter API key)',
        'Launch training: python train.py --config configs/experiment.yaml',
        'Monitor with: wandb status',
        'Verify GPU utilization: watch nvidia-smi'
      ],
      expectedOutcome: 'Training job running, metrics logging to W&B',
      checkpoints: ['Training script starts without errors', 'Loss decreasing', 'GPU utilization >80%'],
      materials: ['W&B account', 'Sufficient compute budget'],
      commonMistakes: [
        'Learning rate too high (loss explodes)',
        'Batch size too large (OOM)',
        'Wrong data path in config'
      ],
      troubleshooting: [
        { problem: 'Loss NaN', solution: 'Reduce learning rate, add gradient clipping' },
        { problem: 'Training hangs', solution: 'Check data loader workers, reduce num_workers' }
      ]
    },
    {
      id: 'step6',
      number: 6,
      title: 'Evaluation',
      duration: '30-45 minutes',
      description: 'Run evaluation on test sets and analyze results',
      detailedInstructions: [
        'Wait for training to complete or load checkpoint',
        'Run evaluation: python evaluate.py --checkpoint best_model.pt',
        'Generate metrics: accuracy, F1, BLEU scores',
        'Create comparison table: baseline vs our method',
        'Run ablation studies: remove one component at a time',
        'Save results: python scripts/save_results.py',
        'Verify results are reproducible (run 3x)'
      ],
      expectedOutcome: 'Complete evaluation metrics, comparison with baseline',
      checkpoints: ['Test accuracy calculated', 'Ablation results recorded', 'Comparison table generated'],
      materials: ['Trained model checkpoint', 'Test datasets'],
      commonMistakes: [
        'Evaluating on training data (leakage)',
        'Not saving model predictions',
        'Forgetting to disable dropout during eval'
      ],
      troubleshooting: [
        { problem: 'Low accuracy', solution: 'Check data preprocessing matches training' },
        { problem: 'Results vary wildly', solution: 'Set random seeds for reproducibility' }
      ]
    },
    {
      id: 'step7',
      number: 7,
      title: 'Result Documentation',
      duration: '20-30 minutes',
      description: 'Document findings and prepare for paper',
      detailedInstructions: [
        'Fill in result template (see Result Recording tab)',
        'Create figures: training curves, comparison charts',
        'Write observations in OBSERVATIONS.md',
        'Note any unexpected findings',
        'Prepare slide deck with key results',
        'Export results for paper integration'
      ],
      expectedOutcome: 'Complete documentation ready for paper writing',
      checkpoints: ['Result template complete', 'Figures generated', 'Observations documented'],
      materials: ['Plotting libraries (matplotlib, seaborn)', 'LaTeX template (optional)'],
      commonMistakes: [
        'Not documenting failed experiments',
        'Missing negative results',
        'Inconsistent figure styles'
      ],
      troubleshooting: [
        { problem: 'Figures look bad', solution: 'Use paper-style templates, increase font sizes' },
        { problem: 'Results unclear', solution: 'Add statistical significance tests' }
      ]
    }
  ],
  expectedResults: [
    {
      metric: 'NarrativeQA Accuracy',
      baselineValue: '78.5%',
      targetValue: '85%+',
      tolerance: '±2%',
      interpretation: 'Higher is better. Measures question answering accuracy on long documents.'
    },
    {
      metric: 'Memory Overhead',
      baselineValue: '100% (baseline)',
      targetValue: '<60%',
      tolerance: '±10%',
      interpretation: 'Lower is better. Measures GPU memory usage relative to baseline.'
    },
    {
      metric: 'Inference Latency',
      baselineValue: '100ms/query',
      targetValue: '<150ms',
      tolerance: '±20ms',
      interpretation: 'Lower is better. Trade-off accepted for memory reduction.'
    },
    {
      metric: 'Context Length',
      baselineValue: '4K tokens',
      targetValue: '100K+ tokens',
      tolerance: 'N/A',
      interpretation: 'Higher is better. Maximum supported context length.'
    }
  ],
  resultTemplate: {
    sections: [
      {
        title: 'Experimental Setup',
        fields: [
          { name: 'Hardware Used', type: 'text', placeholder: 'e.g., NVIDIA A100 40GB' },
          { name: 'Software Versions', type: 'text', placeholder: 'PyTorch 2.0, CUDA 11.8' },
          { name: 'Training Duration', type: 'text', placeholder: 'e.g., 6 hours' }
        ]
      },
      {
        title: 'Main Results',
        fields: [
          { name: 'NarrativeQA Accuracy', type: 'number', placeholder: 'e.g., 85.2' },
          { name: 'Memory Usage (GB)', type: 'number', placeholder: 'e.g., 18.5' },
          { name: 'Inference Time (ms)', type: 'number', placeholder: 'e.g., 142' }
        ]
      },
      {
        title: 'Ablation Studies',
        fields: [
          { name: 'Without Memory Agents', type: 'text', placeholder: 'Results' },
          { name: 'Without Collaboration', type: 'text', placeholder: 'Results' },
          { name: 'Simplified Memory Store', type: 'text', placeholder: 'Results' }
        ]
      },
      {
        title: 'Observations',
        fields: [
          { name: 'Key Findings', type: 'text', placeholder: 'Main discoveries...' },
          { name: 'Unexpected Results', type: 'text', placeholder: 'Any surprises...' },
          { name: 'Limitations', type: 'text', placeholder: 'Known limitations...' }
        ]
      },
      {
        title: 'Artifacts',
        fields: [
          { name: 'Model Checkpoint', type: 'file' },
          { name: 'Training Logs', type: 'file' },
          { name: 'Result Figures', type: 'file' }
        ]
      }
    ]
  }
};

export default function ExperimentGuideGenerator() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'prerequisites' | 'hardware' | 'steps' | 'results'>('overview');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [checkedPrereqs, setCheckedPrereqs] = useState<Set<string>>(new Set());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [stepProgress, setStepProgress] = useState<Record<string, number>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const guide = MOCK_GUIDE;

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const togglePrereq = (itemId: string) => {
    setCheckedPrereqs(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const startStepExecution = async (stepId: string) => {
    setIsRunning(true);
    setExpandedSteps(prev => new Set([...prev, stepId]));

    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setStepProgress(prev => ({ ...prev, [stepId]: i }));
    }

    setCompletedSteps(prev => new Set([...prev, stepId]));
    setIsRunning(false);
  };

  const downloadGuide = () => {
    const guideJson = JSON.stringify(guide, null, 2);
    const blob = new Blob([guideJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment-guide-${guide.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allPrereqsChecked = guide.prerequisites.flatMap(p => p.items).length === checkedPrereqs.size;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                <ChevronUp size={20} className="rotate-[-90deg]" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Beaker size={24} className="text-emerald-500" />
                  Experiment Guide
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{guide.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-sm">{guide.estimatedTotalTime}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                guide.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                guide.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {guide.difficulty}
              </span>
              <button
                onClick={downloadGuide}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
              >
                <Download size={18} />
                Export Guide
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: BookOpen },
              { id: 'prerequisites', label: 'Prerequisites', icon: ClipboardList },
              { id: 'hardware', label: 'Hardware & Software', icon: Package },
              { id: 'steps', label: 'Step-by-Step', icon: Play },
              { id: 'results', label: 'Results', icon: Save }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-500'
                    : 'border-transparent hover:text-white'
                }`}
                style={activeTab !== tab.id ? { color: 'var(--text-secondary)' } : {}}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Lightbulb size={20} className="text-yellow-500" />
                    Experiment Objective
                  </h2>
                  <p className="leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{guide.objective}</p>
                </div>

                <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-500" />
                    Expected Results
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {guide.expectedResults.map((result, idx) => (
                      <div key={idx} className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{result.metric}</div>
                        <div className="flex items-center gap-2 text-lg">
                          <span className="line-through text-sm" style={{ color: 'var(--text-muted)' }}>{result.baselineValue}</span>
                          <span className="text-emerald-400 font-bold">→ {result.targetValue}</span>
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{result.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                    Quick Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Total Steps</span>
                      <span className="font-semibold">{guide.steps.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Est. Time</span>
                      <span className="font-semibold">{guide.estimatedTotalTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Difficulty</span>
                      <span className="font-semibold capitalize">{guide.difficulty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Prerequisites</span>
                      <span className="font-semibold">{guide.prerequisites.flatMap(p => p.items).length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/30 p-6">
                  <h3 className="text-sm font-semibold text-indigo-400 mb-2">
                    Ready to Start?
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Check prerequisites first, then follow the step-by-step guide.
                  </p>
                  <button
                    onClick={() => setActiveTab('prerequisites')}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
                  >
                    Check Prerequisites
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Prerequisites Tab */}
          {activeTab === 'prerequisites' && (
            <motion.div
              key="prerequisites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl"
            >
              <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Prerequisites Checklist</span>
                  <span className={`text-sm font-semibold ${
                    allPrereqsChecked ? 'text-emerald-400' : ''
                  }`} style={!allPrereqsChecked ? { color: 'var(--text-secondary)' } : {}}>
                    {checkedPrereqs.size} / {guide.prerequisites.flatMap(p => p.items).length} checked
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(checkedPrereqs.size / guide.prerequisites.flatMap(p => p.items).length) * 100}%` }}
                    className={`h-full rounded-full ${allPrereqsChecked ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  />
                </div>
              </div>

              <div className="space-y-6">
                {guide.prerequisites.map((category) => (
                  <div key={category.id} className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>{category.category}</h3>
                    <div className="space-y-3">
                      {category.items.map((item) => (
                        <div
                          key={item.name}
                          onClick={() => togglePrereq(item.name)}
                          className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                            checkedPrereqs.has(item.name)
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'hover:bg-opacity-80'
                          }`}
                          style={!checkedPrereqs.has(item.name) ? { backgroundColor: 'var(--bg-surface)' } : {}}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            checkedPrereqs.has(item.name)
                              ? 'bg-emerald-500 text-white'
                              : ''
                          }`}
                          style={!checkedPrereqs.has(item.name) ? { backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' } : {}}
                          >
                            {checkedPrereqs.has(item.name) ? <Check size={14} /> : <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.description}</div>
                            {item.resources && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.resources.map((resource, idx) => (
                                  <a
                                    key={idx}
                                    href={resource}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs px-2 py-1 rounded text-indigo-400 hover:text-indigo-300"
                                    style={{ backgroundColor: 'var(--bg-surface)' }}
                                  >
                                    Resource {idx + 1} ↗
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Hardware Tab */}
          {activeTab === 'hardware' && (
            <motion.div
              key="hardware"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Hardware Requirements */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Monitor size={20} className="text-blue-500" />
                  Hardware Requirements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {guide.hardware.map((hw, idx) => (
                    <div key={idx} className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                      <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{hw.name}</div>
                      <div className="text-sm text-emerald-400 mb-2">{hw.specs}</div>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{hw.purpose}</p>
                      {hw.alternatives && (
                        <div className="text-xs">
                          <span style={{ color: 'var(--text-muted)' }}>Alternatives: </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{hw.alternatives.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Software Requirements */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Package size={20} className="text-purple-500" />
                  Software Requirements
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left" style={{ borderBottomColor: 'var(--border-subtle)', borderBottomWidth: '1px' }}>
                        <th className="pb-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Software</th>
                        <th className="pb-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Version</th>
                        <th className="pb-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Install Command</th>
                        <th className="pb-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guide.software.map((sw, idx) => (
                        <tr key={idx} style={{ borderBottomColor: 'var(--border-subtle)', borderBottomWidth: '1px', opacity: 0.5 }}>
                          <td className="py-4">
                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{sw.name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sw.purpose}</div>
                          </td>
                          <td className="py-4" style={{ color: 'var(--text-secondary)' }}>{sw.version}</td>
                          <td className="py-4">
                            {sw.installCommand && (
                              <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                                {sw.installCommand}
                              </code>
                            )}
                          </td>
                          <td className="py-4">
                            {sw.checkCommand && (
                              <div className="flex items-center gap-2">
                                <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                                  {sw.checkCommand}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(sw.checkCommand!, `check-${idx}`)}
                                  className="hover:opacity-80"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {copiedField === `check-${idx}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Datasets */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Database size={20} className="text-emerald-500" />
                  Datasets
                </h2>
                <div className="space-y-4">
                  {guide.datasets.map((ds, idx) => (
                    <div key={idx} className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{ds.name}</span>
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{ds.size}</span>
                      </div>
                      <div className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Format: {ds.format} • Source: {ds.source}</div>
                      {ds.preprocessing && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Preprocessing: {ds.preprocessing.join(' → ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Steps Tab */}
          {activeTab === 'steps' && (
            <motion.div
              key="steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl"
            >
              <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {completedSteps.size} / {guide.steps.length} completed
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedSteps.size / guide.steps.length) * 100}%` }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {guide.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`rounded-2xl border transition-all ${
                      completedSteps.has(step.id)
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : ''
                    }`}
                    style={!completedSteps.has(step.id) ? { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' } : {}}
                  >
                    <button
                      onClick={() => toggleStep(step.id)}
                      className="w-full p-6 flex items-center gap-4"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        completedSteps.has(step.id)
                          ? 'bg-emerald-500 text-white'
                          : ''
                      }`}
                      style={!completedSteps.has(step.id) ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' } : {}}
                      >
                        {completedSteps.has(step.id) ? <CheckCircle size={20} /> : step.number}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{step.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{step.duration}</span>
                        {expandedSteps.has(step.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedSteps.has(step.id) && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 space-y-6">
                            {/* Progress Bar if running */}
                            {isRunning && stepProgress[step.id] !== undefined && (
                              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                                <motion.div
                                  animate={{ width: `${stepProgress[step.id]}%` }}
                                  className="h-full bg-indigo-500"
                                />
                              </div>
                            )}

                            {/* Instructions */}
                            <div>
                              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                                Detailed Instructions
                              </h4>
                              <ol className="space-y-2">
                                {step.detailedInstructions.map((instruction, idx) => (
                                  <li key={idx} className="flex gap-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    <span className="text-indigo-400 font-medium">{idx + 1}.</span>
                                    <code className="px-2 py-0.5 rounded font-mono text-xs" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                                      {instruction}
                                    </code>
                                  </li>
                                ))}
                              </ol>
                            </div>

                            {/* Expected Outcome */}
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                              <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                                <CheckCircle size={16} />
                                Expected Outcome
                              </h4>
                              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{step.expectedOutcome}</p>
                            </div>

                            {/* Checkpoints */}
                            <div>
                              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                                Verification Checkpoints
                              </h4>
                              <ul className="space-y-2">
                                {step.checkpoints.map((checkpoint, idx) => (
                                  <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--text-muted)' }} />
                                    {checkpoint}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Materials */}
                            <div className="flex flex-wrap gap-2">
                              {step.materials.map((material, idx) => (
                                <span key={idx} className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                  {material}
                                </span>
                              ))}
                            </div>

                            {/* Common Mistakes */}
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                              <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Common Mistakes to Avoid
                              </h4>
                              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {step.commonMistakes.map((mistake, idx) => (
                                  <li key={idx}>• {mistake}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Troubleshooting */}
                            <div>
                              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                                Troubleshooting
                              </h4>
                              <div className="space-y-2">
                                {step.troubleshooting.map((item, idx) => (
                                  <div key={idx} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
                                    <div className="text-sm text-red-400 mb-1">Problem: {item.problem}</div>
                                    <div className="text-sm text-emerald-400">Solution: {item.solution}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                              {!completedSteps.has(step.id) && (
                                <button
                                  onClick={() => startStepExecution(step.id)}
                                  disabled={isRunning}
                                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                                >
                                  {isRunning ? <Pause size={18} /> : <Play size={18} />}
                                  {isRunning ? 'Running...' : 'Start Step'}
                                </button>
                              )}
                              <button
                                onClick={() => copyToClipboard(step.detailedInstructions.join('\n'), `step-${step.id}`)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                                style={{ backgroundColor: 'var(--bg-surface)' }}
                              >
                                {copiedField === `step-${step.id}` ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                Copy Instructions
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl space-y-6"
            >
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-semibold mb-6">Result Documentation</h2>

                {guide.resultTemplate.sections.map((section, idx) => (
                  <div key={idx} className="mb-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
                      {section.title}
                    </h3>
                    <div className="space-y-3">
                      {section.fields.map((field, fieldIdx) => (
                        <div key={fieldIdx}>
                          <label className="block text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>{field.name}</label>
                          {field.type === 'file' ? (
                            <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                              <FileText size={20} style={{ color: 'var(--text-muted)' }} />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Drop files here or click to upload</span>
                            </div>
                          ) : field.type === 'table' ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left" style={{ borderBottomColor: 'var(--border-subtle)', borderBottomWidth: '1px' }}>
                                    <th className="pb-2" style={{ color: 'var(--text-muted)' }}>Metric</th>
                                    <th className="pb-2" style={{ color: 'var(--text-muted)' }}>Value</th>
                                    <th className="pb-2" style={{ color: 'var(--text-muted)' }}>Unit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr style={{ borderBottomColor: 'var(--border-subtle)', borderBottomWidth: '1px', opacity: 0.5 }}>
                                    <td className="py-2" style={{ color: 'var(--text-secondary)' }}>Example Metric</td>
                                    <td className="py-2"><input type="text" className="rounded px-2 py-1 w-24" style={{ backgroundColor: 'var(--bg-surface)' }} /></td>
                                    <td className="py-2" style={{ color: 'var(--text-muted)' }}>%</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <input
                              type={field.type}
                              placeholder={field.placeholder}
                              className="w-full p-3 rounded-lg border focus:border-indigo-500 focus:outline-none"
                              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-6" style={{ borderTopColor: 'var(--border-subtle)', borderTopWidth: '1px' }}>
                  <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors">
                    <Save size={18} />
                    Save Results
                  </button>
                  <button
                    onClick={downloadGuide}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <Download size={18} />
                    Export JSON
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
