import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Atomic `<button>` wrapper — a thin native pass-through (defaults `type="button"` to avoid
 * accidental form submits). `variant` maps to `data-vtk-variant`; styled via `[data-vtk-button]`
 * + `@scope`.
 */
export function Button({ type, variant, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      data-vtk-button=""
      data-vtk-variant={variant}
      {...props}
    />
  );
}
