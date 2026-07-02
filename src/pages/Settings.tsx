import React, { useEffect, useState } from 'react';
import {
  CloudSync,
  Plus,
  Smartphone,
  Lock,
  UserCheck,
  FolderPlus,
  RefreshCw,
  X,
  FileCheck,
  Clock,
  LogOut,
  Landmark,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import useOfflineStore from '../store/useOfflineStore';
import useAuthStore from '../store/useAuthStore';
import apiClient from '../services/apiClient';
import { IDBHelper } from '../utils/idbHelper';
import Drawer from '../components/Drawer';

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  status: string;
}

export const Settings: React.FC = () => {
  const { isOnline } = useOfflineStore();
  const { user, logout } = useAuthStore();

  // App Lock local setting
  const [appLockEnabled, setAppLockEnabled] = useState(
    localStorage.getItem('yc_app_lock_enabled') === 'true',
  );

  // Data Lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [backupPending, setBackupPending] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Category inline form state
  const [newCatName, setNewCatName] = useState('');

  // Supplier Form Drawer states
  const [isSupDrawerOpen, setIsSupDrawerOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supGst, setSupGst] = useState('');

  // Pairing code drawer states
  const [isPairingDrawerOpen, setIsPairingDrawerOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingTimer, setPairingTimer] = useState(0);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const cachedCats = await IDBHelper.getAll<Category>('categories');
      setCategories(cachedCats);

      // 2. Fetch suppliers
      const cachedSups = await IDBHelper.getAll<Supplier>('suppliers');
      setSuppliers(cachedSups);

      // 3. Load cloud settings (backup info)
      if (isOnline) {
        const settingsRes = await apiClient.get('/settings');
        const settings = settingsRes.data.data;

        setBackupPending(settings.backupPending);
        setLastBackup(settings.lastBackupAt);

        // Update local settings DB
        await IDBHelper.put('settings', {
          key: 'backupPending',
          value: String(settings.backupPending),
        });
        if (settings.lastBackupAt) {
          await IDBHelper.put('settings', {
            key: 'lastBackupAt',
            value: settings.lastBackupAt,
          });
        }
      } else {
        const bp = await IDBHelper.get('settings', 'backupPending');
        const lb = await IDBHelper.get('settings', 'lastBackupAt');
        setBackupPending(bp?.value === 'true');
        setLastBackup(lb?.value || null);
      }
    } catch (e) {
      console.error('Settings loading warning:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, [isOnline]);

  // App Lock change handler
  const handleToggleAppLock = () => {
    const nextVal = !appLockEnabled;
    setAppLockEnabled(nextVal);
    localStorage.setItem('yc_app_lock_enabled', String(nextVal));

    if (isOnline) {
      apiClient.post('/settings', { appLockEnabled: nextVal }).catch(console.error);
    }
  };

  // Cloud backup handler
  const handleBackupSync = async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/settings/backup-sync');
      if (res.data.status === 'success') {
        setBackupPending(false);
        setLastBackup(res.data.data.lastBackupAt);

        // Update cache
        await IDBHelper.put('settings', {
          key: 'backupPending',
          value: 'false',
        });
        await IDBHelper.put('settings', {
          key: 'lastBackupAt',
          value: res.data.data.lastBackupAt,
        });
      }
    } catch (e) {
      console.error(e);
      alert('Backup sync failed.');
    } finally {
      setLoading(false);
    }
  };

  // Create Category handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      alert('Online connectivity is required to modify master directories.');
      return;
    }
    if (!newCatName.trim()) return;

    try {
      const res = await apiClient.post('/categories', {
        name: newCatName.trim(),
      });
      if (res.data.status === 'success') {
        setNewCatName('');
        // Reload list
        const updatedCats = await apiClient.get('/categories');
        setCategories(updatedCats.data.data);
        await IDBHelper.putAll('categories', updatedCats.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed creating category.');
    }
  };

  // Create Supplier handler
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      alert('Online connection required.');
      return;
    }
    if (!supName.trim()) return;

    try {
      const res = await apiClient.post('/suppliers', {
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        address: supAddress.trim() || undefined,
        gstNumber: supGst.trim() || undefined,
      });

      if (res.data.status === 'success') {
        setIsSupDrawerOpen(false);
        setSupName('');
        setSupPhone('');
        setSupAddress('');
        setSupGst('');

        // Reload suppliers
        const updatedSups = await apiClient.get('/suppliers');
        setSuppliers(updatedSups.data.data);
        await IDBHelper.putAll('suppliers', updatedSups.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed creating supplier.');
    }
  };

  // Generate device link code handler
  const handleGenerateLinkCode = async () => {
    if (!isOnline) {
      alert('You must be online to pair additional devices.');
      return;
    }

    try {
      const res = await apiClient.post('/auth/link-code');
      const { code, expiresInSeconds } = res.data.data;
      setPairingCode(code);
      setPairingTimer(expiresInSeconds);
      setIsPairingDrawerOpen(true);
    } catch (e) {
      console.error(e);
      alert('Failed generating pairing code.');
    }
  };

  // Link code countdown timer hook
  useEffect(() => {
    if (pairingTimer <= 0) {
      setPairingCode(null);
      return;
    }

    const interval = setInterval(() => {
      setPairingTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [pairingTimer]);

  return (
    <div className="space-y-6 pb-24">
      {/* CLOUD SYNC & BACKUP STATUS */}
      <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-4 animate-slide-up">
        <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
          Cloud Backup Status
        </h2>

        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-2xl ${
              backupPending
                ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/20'
                : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20'
            }`}
          >
            <CloudSync size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {backupPending ? 'Backup Sync Required' : 'Database Cloud Backup Valid'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              Last Synced:{' '}
              {lastBackup
                ? new Date(lastBackup).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Never'}
            </p>
          </div>
        </div>

        {isOnline && backupPending && (
          <button
            onClick={handleBackupSync}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-md glow-brand"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync Backup to Cloud</span>
          </button>
        )}
      </div>

      {/* SECURITY SETTINGS */}
      <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-3">
        <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
          Device & Security Options
        </h2>

        {/* App Lock Toggle */}
        <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-darkBg rounded-xl border border-slate-100 dark:border-darkBorder">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-slate-400 animate-pulse-subtle" />
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Unlock Protection
              </p>
              <p className="text-[9px] text-slate-400 font-medium">
                Prompt biometrics on application unlock events.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAppLock}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none ${
              appLockEnabled ? 'bg-[#003229]' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                appLockEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Add Device Pairing */}
        {isOnline && (
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-darkBg rounded-xl border border-slate-100 dark:border-darkBorder">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Link New Device
                </p>
                <p className="text-[9px] text-slate-400 font-medium">
                  Generate secure passcode to link secondary biometrics.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateLinkCode}
              className="px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-500 dark:text-brand-400 dark:bg-brand-950/20 text-[10px] font-extrabold rounded-lg border border-brand-200/10 active:scale-95 transition-all"
            >
              Link Passkey
            </button>
          </div>
        )}
      </div>

      {/* FINANCIALS & EXPENSES */}
      <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-3">
        <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
          Financial Management
        </h2>
        <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-darkBg rounded-xl border border-slate-100 dark:border-darkBorder">
          <div className="flex items-center gap-2">
            <Landmark size={15} className="text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Business Expenses
              </p>
              <p className="text-[9px] text-slate-400 font-medium">
                Log CA payments, packing materials, and utility costs.
              </p>
            </div>
          </div>
          <Link
            to="/expenses"
            className="px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-500 dark:text-brand-400 dark:bg-brand-950/20 text-[10px] font-extrabold rounded-lg border border-brand-200/10 active:scale-95 transition-all text-center"
          >
            Manage Expenses
          </Link>
        </div>
      </div>

      {/* CATEGORY MASTER CRUD */}
      <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-3.5">
        <div className="flex items-center gap-1.5 text-slate-400">
          <FolderPlus size={16} />
          <h2 className="text-xs font-black uppercase tracking-wider">
            Categories Directory ({categories.length})
          </h2>
        </div>

        {/* Inline Add form */}
        {isOnline && (
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Add category (e.g. Saree, Kurta)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-3 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl active:scale-95 transition-all shadow-md"
            >
              <Plus size={16} />
            </button>
          </form>
        )}

        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-darkBorder bg-slate-50/50 dark:bg-darkBg/30 border border-slate-100 dark:border-darkBorder rounded-xl p-2">
          {categories.length === 0 ? (
            <p className="text-center text-[10px] text-slate-400 py-4">No categories registered.</p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="py-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {c.name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* SUPPLIER CRUD REGISTER */}
      <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <UserCheck size={16} />
            <h2 className="text-xs font-black uppercase tracking-wider">
              Suppliers Register ({suppliers.length})
            </h2>
          </div>
          {isOnline && (
            <button
              onClick={() => setIsSupDrawerOpen(true)}
              className="p-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 rounded-lg active:scale-95 transition-all"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-darkBorder bg-slate-50/50 dark:bg-darkBg/30 border border-slate-100 dark:border-darkBorder rounded-xl p-2">
          {suppliers.length === 0 ? (
            <p className="text-center text-[10px] text-slate-400 py-4">No suppliers registered.</p>
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="py-2 flex justify-between text-xs items-center">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{s.name}</p>
                  {s.phone && <p className="text-[9px] text-slate-400 mt-0.5">Ph: {s.phone}</p>}
                </div>
                <span
                  className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    s.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Logout */}
      <div className="px-2">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 dark:text-rose-400 font-bold rounded-xl text-xs transition-colors active:scale-95"
        >
          <LogOut size={16} />
          <span>Exit Account Session</span>
        </button>
      </div>

      {/* SUPPLIER DRAWER ENTRY MODAL */}
      <Drawer
        isOpen={isSupDrawerOpen}
        onClose={() => setIsSupDrawerOpen(false)}
        title="Add New Supplier"
      >
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Supplier Name *
            </label>
            <input
              type="text"
              required
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              placeholder="e.g. Balaji Textiles"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Phone Number
            </label>
            <input
              type="tel"
              value={supPhone}
              onChange={(e) => setSupPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              GST Number
            </label>
            <input
              type="text"
              value={supGst}
              onChange={(e) => setSupGst(e.target.value)}
              placeholder="e.g. 24AAAAB1111A1Z1"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Office Address
            </label>
            <input
              type="text"
              value={supAddress}
              onChange={(e) => setSupAddress(e.target.value)}
              placeholder="e.g. Ring Road, Surat"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]"
          >
            Create Supplier profile
          </button>
        </form>
      </Drawer>

      {/* DEVICE PAIRING QR/PASSCODE DRAWER BOTTOM SHEET */}
      <Drawer
        isOpen={isPairingDrawerOpen}
        onClose={() => setIsPairingDrawerOpen(false)}
        title="Pair New Device"
      >
        <div className="text-center space-y-6 py-4">
          <div className="mx-auto w-12 h-12 bg-[#003229]/10 rounded-full flex items-center justify-center text-brand-500 mb-2">
            <Smartphone size={24} className="stroke-[2.5]" />
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Biometric Pairing Code
            </p>
            <p className="text-[10px] text-slate-400 mt-1 px-4">
              Enter this 6-digit verification code on your new device to securely bind its
              biometrics to this account.
            </p>
          </div>

          {pairingCode ? (
            <div className="space-y-3">
              {/* Large Code */}
              <div className="text-4xl font-black tracking-widest text-brand-500 bg-brand-50 dark:bg-brand-950/20 py-4 px-6 rounded-2xl border border-brand-200/10 inline-block font-mono">
                {pairingCode}
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                <Clock size={14} />
                <span>Expires in {pairingTimer} seconds</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/10 text-rose-600 rounded-xl text-xs font-semibold">
              The pairing session has expired. Please close this window and generate a new code.
            </div>
          )}

          <div className="p-4 bg-slate-50 dark:bg-darkBg rounded-xl text-[10px] text-slate-400 text-left space-y-1.5 border border-slate-100 dark:border-darkBorder">
            <p className="font-bold uppercase text-slate-500">Instructions:</p>
            <p>1. Open the PWA login screen on the new smartphone.</p>
            <p>2. Select "Link as Secondary Device" below the register button.</p>
            <p>3. Input this 6-digit code and scan your biometrics (Fingerprint/PIN).</p>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default Settings;
