import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Fingerprint } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';

export const AppLockScreen: React.FC = () => {
  const { userId, unlock, logout } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleBiometricUnlock = async () => {
    if (!userId) {
      setErrorMsg('No user profile found on this device. Please register first.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      // 1. Get options from backend
      const optionsRes = await apiClient.post('/auth/login-options', {
        userId,
      });
      const { options, stateToken } = optionsRes.data.data;

      // 2. Trigger browser WebAuthn API
      const assertionResponse = await startAuthentication(options);

      // 3. Verify assertion response on backend
      const verifyRes = await apiClient.post('/auth/login-verify', {
        credentialResponse: assertionResponse,
        stateToken,
      });

      if (verifyRes.data.status === 'success') {
        unlock(); // Unlock App state in store
      } else {
        setErrorMsg('Authentication failed.');
      }
    } catch (err: any) {
      console.error('Unlock error:', err);
      setErrorMsg(err.response?.data?.message || 'Device verification cancelled or failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-trigger unlock prompt when lock screen mounts
  useEffect(() => {
    if (userId) {
      handleBiometricUnlock();
    } else {
      setErrorMsg('No local profile detected. Please reload/register.');
    }
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-900 text-slate-100 p-6 backdrop-blur-md">
      {/* Branding Header */}
      <div className="flex flex-col items-center mt-12">
        <div className="w-16 h-16 bg-[#003229]/10 rounded-2xl flex items-center justify-center border border-brand-500/20 shadow-lg glow-brand mb-4">
          <ShieldCheck size={36} className="text-brand-500" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
          Yashvi Creation
        </h1>
        <p className="text-xs text-slate-400 mt-1">Purchase & Stock Security</p>
      </div>

      {/* Verification Pad */}
      <div className="flex flex-col items-center my-auto">
        <button
          onClick={handleBiometricUnlock}
          disabled={isVerifying}
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border transition-all duration-200 ${
            isVerifying
              ? 'border-brand-500 bg-[#003229]/10 scale-105 animate-pulse text-brand-400'
              : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-400 active:scale-95'
          }`}
        >
          <Fingerprint size={48} className="stroke-[1.5]" />
          <span className="text-[11px] mt-2 font-medium">
            {isVerifying ? 'Verifying...' : 'Tap to Unlock'}
          </span>
        </button>

        {errorMsg && (
          <div className="flex items-center gap-2 mt-6 px-4 py-2 bg-red-950/40 border border-red-800/30 text-red-300 rounded-lg text-xs max-w-xs text-center animate-slide-up">
            <ShieldAlert size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Footer operations */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <button
          onClick={handleBiometricUnlock}
          disabled={isVerifying}
          className="w-full max-w-xs py-3 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg transition-all"
        >
          Unlock with Biometrics
        </button>

        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-400 font-semibold"
        >
          Exit Current Session
        </button>
      </div>
    </div>
  );
};

export default AppLockScreen;
