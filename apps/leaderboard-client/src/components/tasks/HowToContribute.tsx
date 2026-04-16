'use client';

import { useState, useRef, useEffect } from 'react';
import { Lightbulb, Copy, Check } from 'lucide-react';

type RepoType = 'github' | 'kaggle_dataset' | 'kaggle_model';

interface HowToContributeProps {
  repoType: RepoType;
  githubRepo?: string;
  branchSlug?: string;
}

type BashBlock = { type: 'bash'; commands: string[] };
type TreeBlock = { type: 'tree'; lines: string[] };
type TextBlock = { type: 'text'; content: string };
type Block = BashBlock | TreeBlock | TextBlock;

function buildConfig(
  repoType: RepoType,
  params: { githubRepo?: string; branchSlug?: string },
): Block[] {
  const { githubRepo = 'org/repo', branchSlug = 'your-branch' } = params;
  const repoName = githubRepo.split('/').pop() ?? 'repo';

  switch (repoType) {
    case 'github':
      return [
        { type: 'text', content: 'Clone the repo and checkout to your task branch.' },
        {
          type: 'bash',
          commands: [
            `git clone https://github.com/${githubRepo}.git`,
            `cd ${repoName}`,
            `git checkout ${branchSlug}`,
          ],
        },
        { type: 'text', content: 'Work on this branch, then push your code.' },
        {
          type: 'bash',
          commands: [
            'git add .',
            'git commit -m "feat: my contribution"',
            `git push origin ${branchSlug}`,
          ],
        },
      ];

    case 'kaggle_dataset':
      return [
        { type: 'text', content: 'Create a Kaggle dataset and structure it like so :' },
        {
          type: 'tree',
          lines: [
            'dataset-name/',
            '├── data/',
            '│   ├── images/',
            '│   ├── annotations/',
            '│   └── labels/',
            '├── docs/',
            '│   └── dataset_card.md',
            '├── README.md',
            '└── metadata.csv',
          ],
        },
        { type: 'text', content: 'Submit the link to your dataset in the field below.' },
      ];

    case 'kaggle_model':
      return [
        { type: 'text', content: 'Publish your model on Kaggle with the following structure :' },
        {
          type: 'tree',
          lines: [
            'model-project/',
            '├── model/',
            '│   └── model_weights.pt',
            '├── notebook/',
            '│   └── training_experiment.ipynb',
            '├── train.py',
            '├── inference.py',
            '└── config.yaml',
          ],
        },
        { type: 'text', content: 'Submit the link to your model in the field below.' },
      ];
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copié !' : 'Copier'}
      className="ml-2 shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 transition"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  if (block.type === 'text') {
    return <p className="text-sm text-white/60">{block.content}</p>;
  }

  if (block.type === 'bash') {
    return (
      <div className="rounded-lg bg-black/40 border border-white/10 overflow-hidden">
        {block.commands.map((cmd, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 last:border-0">
            <span className="font-mono text-xs text-green-400 break-all">{cmd}</span>
            <CopyButton text={cmd} />
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'tree') {
    return (
      <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2">
        {block.lines.map((line, i) => (
          <p key={i} className="font-mono text-xs text-white/70 whitespace-pre">{line}</p>
        ))}
      </div>
    );
  }

  return null;
}

export function HowToContribute({ repoType, githubRepo, branchSlug }: HowToContributeProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const blocks = buildConfig(repoType, { githubRepo, branchSlug });

  const labels: Record<RepoType, string> = {
    github: 'Comment contribuer (GitHub)',
    kaggle_dataset: 'Comment contribuer (Dataset Kaggle)',
    kaggle_model: 'Comment contribuer (Modèle Kaggle)',
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        title="How to contribute"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-brandCP/20 hover:text-brandCP transition"
      >
        <Lightbulb className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-11 z-50 w-80 rounded-xl bg-[#1a1a2e] border border-white/10 shadow-xl shadow-black/40 p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">{labels[repoType]}</h3>
          <div className="space-y-3">
            {blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
