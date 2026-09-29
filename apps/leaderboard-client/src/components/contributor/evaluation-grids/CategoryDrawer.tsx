'use client';

import { useEffect, useRef, useState } from 'react';
import { FolderTree, Loader2, Scale, Boxes } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { Field } from '@/components/admin/challengeFormFields';
import type { EvaluationGridCategory, EvaluationGridCategoryType } from '@packages/database-service/domain/entities';

import './evaluation-grids-vitrine.css';

export interface CategoryFormValues {
  name: string;
  weightPercent: number;
  type: EvaluationGridCategoryType;
}

interface CategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  category?: EvaluationGridCategory | null; // present = edit mode
  saving: boolean;
  error: string;
  onSubmit: (values: CategoryFormValues) => void;
}

const TYPE_OPTIONS: { value: EvaluationGridCategoryType; label: string; desc: string }[] = [
  { value: 'objective', label: 'Objective', desc: 'Measured directly (tests, metrics)' },
  { value: 'mixed', label: 'Mixed', desc: 'Part measured, part judged' },
  { value: 'subjective', label: 'Subjective', desc: 'Reviewer judgment' },
  { value: 'contextual', label: 'Contextual', desc: 'Depends on the challenge' },
];

/** Le tiroir d'une catégorie de grille, sur la coque vitrine (`Drawer`). */
export function CategoryDrawer({ open, onClose, category, saving, error, onSubmit }: CategoryDrawerProps) {
  const isEdit = !!category;
  const [name, setName] = useState('');
  const [weightPercent, setWeightPercent] = useState(25);
  const [type, setType] = useState<EvaluationGridCategoryType>('objective');
  const nameRef = useRef<HTMLInputElement>(null);

  // Ne se remplit qu'au passage fermé → ouvert : un `category` recréé par le
  // parent à chaque rendu effacerait sinon la saisie en cours.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;

    setName(category?.name ?? '');
    setWeightPercent(category ? Math.round(category.weight * 100) : 25);
    setType(category?.type ?? 'objective');
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, category]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), weightPercent, type });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="sm"
      icon={<FolderTree />}
      title={isEdit ? 'Edit category' : 'New category'}
      footer={
        <>
          <button type="button" onClick={onClose} className="v-btn-text">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !name.trim()} className="v-btn">
            {saving && <Loader2 className="v-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
          </button>
        </>
      }
    >
      <div className="v-eg-title">
        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name…" />
        <div className="v-eg-title-line" />
      </div>

      <Field icon={<Scale />} label="Weight">
        <div className="v-field-row">
          <input
            type="range"
            min={0}
            max={100}
            value={weightPercent}
            onChange={(e) => setWeightPercent(Number(e.target.value))}
            className="v-eg-range"
          />
          <div className="v-figure" style={{ minWidth: '4rem', justifyContent: 'flex-end' }}>
            <span className="v-figure-value">{weightPercent}</span>
            <span className="v-figure-unit">%</span>
          </div>
        </div>
      </Field>

      <Field icon={<Boxes />} label="Type">
        <div className="v-choices">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className="v-choice"
              data-on={type === opt.value ? 'true' : 'false'}
            >
              <span className="v-choice-text">
                <span className="v-choice-name">{opt.label}</span>
                <span className="v-choice-hint">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>

      {error && <p className="v-alert">{error}</p>}
    </Drawer>
  );
}
