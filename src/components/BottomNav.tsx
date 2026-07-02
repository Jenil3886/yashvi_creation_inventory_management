import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, Plus, ClipboardList, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/products', label: 'Products', icon: Package },
    { path: '/purchase-entry', label: 'Purchase', icon: Plus, isAction: true },
    { path: '/history', label: 'History', icon: ClipboardList },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 dark:bg-darkCard dark:border-darkBorder safe-margin-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);

          if (item.isAction) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative -top-4 flex items-center justify-center w-14 h-14 bg-brand-500 text-white rounded-full shadow-lg hover:bg-brand-600 active:scale-95 transition-all duration-150 glow-brand"
                aria-label="Add Purchase Invoice"
              >
                <Plus size={28} className="stroke-[2.5]" />
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-brand-500 dark:text-brand-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              <Icon
                size={22}
                className={`mb-0.5 transition-transform duration-150 ${
                  isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              <span className="text-[10px] tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
