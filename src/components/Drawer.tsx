import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render via React Portal to escape CSS animation container stacking context
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        ref={drawerRef}
        className="relative z-[9999] w-full max-w-lg bg-white dark:bg-darkCard rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-darkBorder flex flex-col max-h-[90vh] transition-transform duration-300 transform translate-y-0 pb-16 safe-padding-bottom animate-slide-up"
      >
        {/* Notch indicator */}
        <div className="mx-auto my-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100 dark:border-darkBorder">
          <h2 className="text-md font-bold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 select-none">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
