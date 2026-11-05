'use client';

import { Plus, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles';

const OPEN_FORM_EVENT = 'open-form-panel';

/** Pide abrir (y mostrar) el formulario con esa ancla; lo usa el acceso rapido "+ Nuevo ...". */
export function requestOpenFormPanel(anchorId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_FORM_EVENT, { detail: anchorId }));
}

/** Estado abierto/cerrado de un formulario; se abre con la ancla (#id) o con requestOpenFormPanel. */
export function useFormPanel(anchorId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    const open = () => {
      setIsOpen(true);
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const handleRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail === anchorId) {
        open();
      }
    };

    if (window.location.hash === `#${anchorId}`) {
      open();
      // Se quita la ancla para que al recargar o volver a la pagina el formulario no se abra solo.
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    window.addEventListener(OPEN_FORM_EVENT, handleRequest);
    return () => window.removeEventListener(OPEN_FORM_EVENT, handleRequest);
  }, [anchorId]);

  return { isOpen, close, toggle };
}

interface FormPanelButtonProps {
  isOpen: boolean;
  /** Texto del boton cuando el formulario esta cerrado, p. ej. "Nuevo producto". */
  label: string;
  /** Texto del boton cuando esta abierto; hace falta distinguirlo si hay varios botones juntos. */
  openLabel?: string;
  onToggle: () => void;
}

export function FormPanelButton({ isOpen, label, openLabel = 'Cerrar', onToggle }: FormPanelButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      className={isOpen ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
      onClick={onToggle}
    >
      {isOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {isOpen ? openLabel : label}
    </button>
  );
}

interface FormPanelProps {
  anchorId: string;
  /** Texto del boton cuando el formulario esta cerrado, p. ej. "Nuevo producto". */
  label: string;
  /** Recibe `close` para cerrar el formulario al terminar de guardar. */
  children: (close: () => void) => ReactNode;
}

/** Formulario de alta oculto hasta que se pulsa el boton; tambien se abre con la ancla (#id) o con requestOpenFormPanel. */
export function FormPanel({ anchorId, label, children }: FormPanelProps) {
  const { isOpen, close, toggle } = useFormPanel(anchorId);

  return (
    <div id={anchorId} className="scroll-mt-36 space-y-3 md:scroll-mt-6">
      <FormPanelButton isOpen={isOpen} label={label} onToggle={toggle} />

      {isOpen && children(close)}
    </div>
  );
}
