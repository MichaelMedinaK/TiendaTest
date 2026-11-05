'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, useState } from 'react';

import { INPUT_CLASS } from '@/components/ui/styles';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Clases del contenedor (p. ej. para fijar el ancho); `className` va al campo. */
  wrapperClassName?: string;
}

/** Campo de clave con el ojito para ver lo que se escribe. */
export function PasswordInput({ wrapperClassName = '', className = '', ...inputProps }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const label = isVisible ? 'Ocultar contrasena' : 'Mostrar contrasena';

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input {...inputProps} type={isVisible ? 'text' : 'password'} className={`${INPUT_CLASS} pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={label}
        title={label}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
