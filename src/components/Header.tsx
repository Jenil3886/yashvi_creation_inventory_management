import React from "react";
import { Wifi, WifiOff, Sun, Moon, CloudSync } from "lucide-react";
import useOfflineStore from "../store/useOfflineStore";
import useThemeStore from "../store/useThemeStore";
import yashviWebLogoImg from "../assets/Yashvi_web_logo.png";
import yashviLogoImg from "../assets/yashvilogo.png";

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { isOnline, offlineQueue, isSyncing, syncQueue } = useOfflineStore();
  const { theme, toggleTheme } = useThemeStore();

  // Dynamic logo selection based on active theme
  // const activeLogo = theme === 'dark' ? yashviWebLogoImg : yashviLogoImg;
  const activeLogo = theme === "dark" ? yashviWebLogoImg : yashviWebLogoImg;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-darkCard/80 backdrop-blur-md border-b border-slate-200 dark:border-darkBorder px-4 h-20 flex items-center justify-between">
      {/* Brand logo + page title */}
      <div className="flex items-center gap-2">
        <img
          src={activeLogo}
          alt="Yashvi Creation"
          className="h-14 object-contain transition-all bg-[#003229] dark:bg-darkCard/80 p-1 rounded-lg"
        />
        <span className="text-slate-300 dark:text-slate-700 font-light">|</span>
        <h1 className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Offline Queue Sync Indicator */}
        {offlineQueue.length > 0 && (
          <button
            onClick={() => syncQueue()}
            disabled={!isOnline || isSyncing}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full transition-all active:scale-95 ${
              isOnline
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
            title={`${offlineQueue.length} unsynced purchase(s)`}
          >
            <CloudSync size={15} className={isSyncing ? "animate-spin" : ""} />
            <span>{offlineQueue.length} queued</span>
          </button>
        )}

        {/* Network Connectivity Badge */}
        {/* <div
          className={`flex items-center justify-center p-1.5 rounded-full transition-colors ${
            isOnline
              ? "text-brand-500 bg-brand-50 dark:text-brand-400 dark:bg-brand-950/20"
              : "text-rose-500 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 animate-pulse"
          }`}
          title={isOnline ? "Network Connected" : "Network Disconnected"}
        >
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        </div> */}

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-90"
          aria-label="Toggle Theme"
        >
          {theme === "light" ? <Moon size={22} /> : <Sun size={22} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
