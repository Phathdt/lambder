import type { ReactNode } from 'react';
import { Label } from './label';
import { cn } from '@/shared/lib/cn';

// Tiny form-field wrapper that renders label + control + error message.
// Designed to be used with react-hook-form's `register` spread.
interface Props {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, className, children }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
