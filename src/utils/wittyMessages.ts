/**
 * Witty Message Generator
 *
 * Generates contextual, humorous status messages for the research pipeline.
 * Keeps the human researcher sane during long automated runs.
 */

interface WittyContext {
  stage?: number;
  stageName?: string;
  status?: 'start' | 'running' | 'done' | 'failed' | 'gate' | 'complete' | 'fallback';
  topic?: string;
}

const START_MESSAGES = [
  "Buckle up! 23 stages of automated science coming your way.",
  "Starting the research machine. May the p-values be ever in your favor.",
  "Initiating science mode. Caffeine levels in your bloodstream may vary.",
  "Launching the autonomous research pipeline. Hold onto your hypotheses.",
  "Commencing operation: Make Your Advisor Proud (TM).",
];

const RUNNING_MESSAGES: Record<string, string[]> = {
  TOPIC_INIT: [
    "Defining the research question. Spoiler: it's probably 'can we make this better?'",
    "Initializing topic. My neural nets are tingling with curiosity.",
  ],
  PROBLEM_DECOMPOSE: [
    "Breaking the problem into bite-sized pieces. Like a scientific sous-chef.",
    "Decomposing problem. One big scary question → many small manageable ones.",
  ],
  SEARCH_STRATEGY: [
    "Planning the literature hunt. Query formulation is an art form.",
    "Strategizing the search. It's like Google, but for people with PhDs.",
  ],
  LITERATURE_COLLECT: [
    "Reading papers at inhuman speed. My eyes are digital but they still hurt.",
    "Scouring the internet for relevant research. Found 47 papers. That's... a lot.",
    "Collecting literature like a scholarly magpie. Ooh, shiny citation!",
    "Downloading papers. My bandwidth is crying, but my curiosity is satisfied.",
  ],
  LITERATURE_SCREEN: [
    "Screening papers. Separating the signal from the noise (and the hand-waving).",
    "Evaluating relevance. This one has great figures but questionable methodology...",
  ],
  KNOWLEDGE_EXTRACT: [
    "Extracting knowledge. Mining the gold nuggets from academic prose.",
    "Parsing claims and evidence. Fact-checking mode: activated.",
  ],
  SYNTHESIS: [
    "Synthesizing findings. Connecting the dots like a conspiracy theorist, but for science.",
    "Building the knowledge graph. It's like Lego, but with citations.",
  ],
  HYPOTHESIS_GEN: [
    "Generating hypotheses. Wild guesses dressed up in statistical clothing.",
    "Formulating testable predictions. Today's forecast: 70% chance of significance.",
  ],
  EXPERIMENT_DESIGN: [
    "Designing experiments. What to measure, how to measure it, and what could go wrong.",
    "Planning the perfect experiment. In theory, theory and practice are the same...",
  ],
  CODE_GENERATION: [
    "Writing code. My Python is better than my Mandarin, and I don't speak Mandarin.",
    "Generating experiment scripts. PEP 8 compliant, hopefully bug-free. No guarantees.",
  ],
  RESOURCE_PLANNING: [
    "Checking compute requirements. Your GPU is about to earn its keep.",
    "Planning resources. CPUs, GPUs, and prayers — the holy trinity of ML research.",
  ],
  EXPERIMENT_RUN: [
    "Running experiments at 3 AM so you don't have to. Coffee not included.",
    "Executing code. If this were a movie, this is the montage scene.",
    "Training models. My fan is spinning faster than your advisor's head when you say 'deep learning'.",
    "Experiment in progress. Please stand by while I try not to divide by zero.",
  ],
  ITERATIVE_REFINE: [
    "Refining results. First attempt: garbage. Second attempt: slightly better garbage.",
    "Tweaking hyperparameters. It's not overfitting if you call it 'fine-tuning'.",
  ],
  RESULT_ANALYSIS: [
    "Analyzing results. Looking for patterns, outliers, and excuses.",
    "Running statistical tests. p < 0.05 or it didn't happen.",
  ],
  RESEARCH_DECISION: [
    "Making the big decision: continue, pivot, or pretend everything is fine?",
    "Research decision time. The data has spoken. Whether it makes sense is another question.",
  ],
  PAPER_OUTLINE: [
    "Creating the paper skeleton. Introduction, Methods, Results, Discussion — the four horsemen.",
    "Outlining the paper. Structure is the difference between science and word salad.",
  ],
  PAPER_DRAFT: [
    "Writing the paper. Turning blood, sweat, and tensors into beautiful LaTeX.",
    "Drafting. Every great paper starts with a terrible first draft. This is that draft.",
  ],
  PEER_REVIEW: [
    "Reviewing our own work. The harshest critic is always yourself (or Reviewer #2).",
    "Self-critique mode. Identifying weaknesses before Reviewer #2 does it for us.",
  ],
  PAPER_REVISION: [
    "Revising. Addressing criticisms, real and imaginary.",
    "Polishing the paper. Making it shine like a freshly cleaned beaker.",
  ],
  QUALITY_GATE: [
    "Final quality check. Is this NeurIPS-worthy or should we aim for a lesser-known workshop?",
    "Quality gate: The last line of defense between brilliance and embarrassment.",
  ],
  KNOWLEDGE_ARCHIVE: [
    "Archiving knowledge. Future you will thank present you for good documentation.",
    "Saving to knowledge base. Building a fortress of scientific wisdom, one paper at a time.",
  ],
  EXPORT_PUBLISH: [
    "Generating LaTeX. Because Word is for people who enjoy suffering.",
    "Exporting the final package. PDF, BibTeX, and hopes and dreams included.",
  ],
  CITATION_VERIFY: [
    "Verifying citations. Making sure reference [42] actually exists and isn't a Hitchhiker's Guide joke.",
    "Citation check. Every claim needs a source, every source needs to be real.",
  ],
};

const DONE_MESSAGES: Record<string, string[]> = {
  TOPIC_INIT: ["Topic locked and loaded. Onward!"],
  LITERATURE_COLLECT: ["47 papers collected. My reading list is now your reading list."],
  EXPERIMENT_RUN: ["Experiments complete! The data is in, and surprisingly, it makes sense."],
  PAPER_DRAFT: ["Draft complete! It's not Shakespeare, but it's science."],
};

const GATE_MESSAGES = [
  "I've designed an experiment. It might work. It might explode. Your call.",
  "Gate reached. Human approval required. This is where you earn your co-authorship.",
  "Pause for human judgment. AI is confident; you should probably verify anyway.",
];

const COMPLETE_MESSAGES = [
  "Paper complete! I'd say 'you're welcome' but technically I did all the work.",
  "23 stages, 0 human tears. A new record!",
  "Pipeline finished. Your paper is ready for world domination... I mean, peer review.",
  "Done! The paper is written. Now comes the hard part: convincing reviewers it's good.",
];

const FAILED_MESSAGES = [
  "Oops. The LLM had a moment. Retrying with slightly less enthusiasm.",
  "Stage failed. Don't panic — this is why we have fallback strategies and therapists.",
  "Something went wrong. But hey, failed experiments are still science! (Right?)",
];

const FALLBACK_MESSAGES = [
  "Falling back to simulated mode. Real AI is on a coffee break.",
  "Switching to demo mode. The real pipeline will be back after it fixes its existential crisis.",
];

function pickRandom(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function getWittyMessage(context: WittyContext): string {
  const { stage, stageName, status, topic } = context;

  switch (status) {
    case 'start':
      return pickRandom(START_MESSAGES);

    case 'running':
      if (stageName && RUNNING_MESSAGES[stageName]) {
        return pickRandom(RUNNING_MESSAGES[stageName]);
      }
      if (stageName && DONE_MESSAGES[stageName]) {
        return pickRandom(DONE_MESSAGES[stageName]);
      }
      return `Working on ${stageName || 'something mysterious'}...`;

    case 'done':
      if (stageName && DONE_MESSAGES[stageName]) {
        return pickRandom(DONE_MESSAGES[stageName]);
      }
      return `${stageName || 'Stage'} completed. Moving right along!`;

    case 'gate':
      return pickRandom(GATE_MESSAGES);

    case 'complete':
      return pickRandom(COMPLETE_MESSAGES);

    case 'failed':
      return pickRandom(FAILED_MESSAGES);

    case 'fallback':
      return pickRandom(FALLBACK_MESSAGES);

    default:
      return 'Processing...';
  }
}

export function getStageWittyDescription(stageName: string): string {
  const descriptions: Record<string, string> = {
    TOPIC_INIT: "Defining what we're actually trying to solve",
    PROBLEM_DECOMPOSE: "Breaking the big problem into manageable pieces",
    SEARCH_STRATEGY: "Planning how to find the right papers",
    LITERATURE_COLLECT: "Scouring the academic internet for gold",
    LITERATURE_SCREEN: "Separating the gems from the... less gemmy",
    KNOWLEDGE_EXTRACT: "Mining claims, evidence, and methods from papers",
    SYNTHESIS: "Connecting dots to build a coherent picture",
    HYPOTHESIS_GEN: "Making educated guesses we can test",
    EXPERIMENT_DESIGN: "Planning what to measure and how",
    CODE_GENERATION: "Writing the scripts that will do the science",
    RESOURCE_PLANNING: "Making sure we have enough compute (and patience)",
    EXPERIMENT_RUN: "Actually running the experiments. Fingers crossed.",
    ITERATIVE_REFINE: "Tweaking until the results look reasonable",
    RESULT_ANALYSIS: "Staring at numbers until patterns emerge",
    RESEARCH_DECISION: "The big choice: continue, pivot, or panic?",
    PAPER_OUTLINE: "Building the skeleton of our masterpiece",
    PAPER_DRAFT: "Turning science into words. Many words.",
    PEER_REVIEW: "Critiquing ourselves before Reviewer #2 does",
    PAPER_REVISION: "Polishing until it shines (or we give up)",
    QUALITY_GATE: "Final check: Is this actually good?",
    KNOWLEDGE_ARCHIVE: "Saving everything for future generations",
    EXPORT_PUBLISH: "Packaging it all up for submission",
    CITATION_VERIFY: "Making sure we didn't cite a pizza recipe",
  };
  return descriptions[stageName] || stageName;
}
