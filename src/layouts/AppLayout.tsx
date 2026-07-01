import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import AppLockScreen from '../components/AppLockScreen';
import useAuthStore from '../store/useAuthStore';
import useOfflineStore from '../store/useOfflineStore';
import appIconImg from '../assets/AppIcon.png';

export const AppLayout: React.FC = () => {
  const { user, token, appLocked, bootstrap, isInitialized } = useAuthStore();
  const { loadQueue, syncQueue, isOnline } = useOfflineStore();
  const location = useLocation();
  const navigate = useNavigate();

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Run initialization on app boot
  useEffect(() => {
    bootstrap();
    loadQueue();
  }, [bootstrap, loadQueue]);

  // Sync offline queue when transitioning online
  useEffect(() => {
    if (isOnline && isInitialized && token) {
      syncQueue();
    }
  }, [isOnline, isInitialized, token, syncQueue]);

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (isInitialized && !token && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [isInitialized, token, location.pathname, navigate]);

  // Listen to beforeinstallprompt event for PWA installation
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser mini-infobar prompt
      e.preventDefault();
      // Cache prompt trigger event
      setDeferredPrompt(e);
      // Display installation suggestion banner in app UI
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful app installations
    const handleAppInstalled = () => {
      console.log('PWA has been installed successfully.');
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser's install dialog box
    deferredPrompt.prompt();
    
    // Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install Prompt outcome: ${outcome}`);
    
    // Dismiss prompt reference since it's already spent
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-darkBg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Yashvi Creation Loading...</p>
        </div>
      </div>
    );
  }

  // Display Lock Screen if active
  if (token && appLocked) {
    return <AppLockScreen />;
  }

  // Resolve Header page title based on location path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/products')) return 'Product Master';
    if (path.startsWith('/purchase-entry')) return 'New Purchase';
    if (path.startsWith('/history')) return 'Purchase Invoices';
    if (path.startsWith('/reports')) return 'Purchase Reports';
    if (path.startsWith('/settings')) return 'System Settings';
    return 'Yashvi Creation';
  };

  const showNav = location.pathname !== '/login';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-darkBg text-slate-800 dark:text-slate-200 pb-20 select-none">
      {showNav && <Header title={getPageTitle()} />}

      {/* Dynamic PWA Install Banner */}
      {showNav && showInstallBanner && deferredPrompt && (
        <div className="w-full max-w-lg mx-auto px-4 pt-4 animate-slide-up">
          <div className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-3">
              <img
                src={appIconImg}
                alt="Yashvi Creation App Icon"
                className="w-10 h-10 rounded-xl object-cover bg-white p-0.5 border border-white/20 shadow-md"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-wider">Install App</p>
                <p className="text-[10px] text-brand-100 font-semibold mt-0.5">
                  Save to Home Screen for fast mobile access!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 z-10">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-white text-brand-600 text-[10px] font-black uppercase rounded-xl hover:bg-slate-100 active:scale-95 transition-all shadow"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="px-2 py-1.5 hover:bg-white/10 rounded-xl text-brand-100 hover:text-white transition-all text-[10px] font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 animate-slide-up">
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};

export default AppLayout;
