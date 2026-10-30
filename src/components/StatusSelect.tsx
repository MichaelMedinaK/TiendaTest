'use client';

import { useState, useTransition } from 'react';

import type { ActionResult } from '@/lib/action-result';
import { INPUT_CLASS } from '@/components/ui/styles';
import { useFeedback } from '@/components/ui/FeedbackProvider';

interface SelectOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface StatusSelectProps<TValue extends string> {
  value: TValue;
  options: SelectOption<TValue>[];
  ariaLabel: string;
  onChangeAction: (nextValue: TValue) => Promise<ActionResult<unknown>>;
}

/**
 * Select reutilizable que persiste el cambio al instante.
 * Ante un fallo revierte el valor mostrado para no mentir sobre el estado real.
 */
export function StatusSelect<TValue extends string>({
  value,
  options,
  ariaLabel,
  onChangeAction,
}: StatusSelectProps<TValue>) {
  const [selectedValue, setSelectedValue] = useState<TValue>(value);
  const [isPending, startTransition] = useTransition();
  const feedback = useFeedback();

  const handleChange = (nextValue: TValue) => {
    const previousValue = selectedValue;
    setSelectedValue(nextValue);

    startTransition(async () => {
      const result = await onChangeAction(nextValue);

      if (!result.success) {
        setSelectedValue(previousValue);
        feedback.error(result.error);
        return;
      }

      feedback.success('Estado actualizado');
    });
  };

  return (
    <div className="md:min-w-[9.5rem]">
      <select
        aria-label={ariaLabel}
        className={`${INPUT_CLASS} py-1.5`}
        disabled={isPending}
        value={selectedValue}
        onChange={(event) => handleChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
