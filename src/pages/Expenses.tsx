import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ArrowLeft, Wifi, WifiOff, RefreshCw, Landmark, ShoppingBag, Truck, FileText, IndianRupee } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { IDBHelper } from '../utils/idbHelper';
import { useOfflineStore } from '../store/useOfflineStore';
import type { OfflineExpense } from '../store/useOfflineStore';

interface ExpenseFormInput {
  title: string;
  amount: string;
  category: string;
  expenseDate: string;
  remarks?: string;
}

const CATEGORIES = [
  { id: 'CA/Legal', name: 'CA / Legal', icon: Landmark, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  { id: 'Packaging', name: 'Packaging Materials', icon: ShoppingBag, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { id: 'Logistics/Transport', name: 'Logistics / Transport', icon: Truck, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { id: 'Office Supplies', name: 'Office Supplies', icon: FileText, color: 'text-teal-400 bg-teal-400/10 border-teal-400/20' },
  { id: 'Others', name: 'Others', icon: IndianRupee, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
];

export const Expenses: React.FC = () => {
  const { isOnline, offlineExpenses, enqueueExpense, syncExpenses, loadExpensesQueue } = useOfflineStore();
  const [expenses, setExpenses] = useState<OfflineExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseFormInput>();

  // Fetch / load cached data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch instantly from IndexedDB cache
      const cached = await IDBHelper.getAll<OfflineExpense>('expenses');
      setExpenses(cached.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()));

      // 2. Fetch from backend if online
      if (isOnline) {
        const response = await apiClient.get('/expenses');
        const freshExpenses: OfflineExpense[] = response.data.data;
        
        // Update IndexedDB cache
        await IDBHelper.clear('expenses');
        await IDBHelper.putAll('expenses', freshExpenses);
        
        // Update state
        setExpenses(freshExpenses);
      }
    } catch (err: any) {
      console.error('Failed to load expenses:', err);
      // Fallback is already loaded from cache
      setError('Loaded offline cache. Could not sync with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpensesQueue();
    loadData();
  }, []);

  // Sync when coming online
  useEffect(() => {
    if (isOnline && offlineExpenses.length > 0) {
      syncExpenses().then(() => loadData());
    }
  }, [isOnline, offlineExpenses.length]);

  const onSubmit = async (data: ExpenseFormInput) => {
    setError(null);
    const newExpense: OfflineExpense = {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      category: data.category,
      expenseDate: data.expenseDate || new Date().toISOString().split('T')[0],
      remarks: data.remarks?.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      if (isOnline) {
        // Submit directly to API
        await apiClient.post('/expenses', {
          title: newExpense.title,
          amount: newExpense.amount,
          category: newExpense.category,
          expenseDate: newExpense.expenseDate,
          remarks: newExpense.remarks,
        });
      } else {
        // Enqueue offline
        await enqueueExpense(newExpense);
      }

      // Add to local state list immediately
      setExpenses((prev) => [newExpense, ...prev]);
      setShowAddForm(false);
      reset();
      loadData();
    } catch (err: any) {
      console.error('Failed to add expense:', err);
      setError('Could not save expense. Please check input values.');
    }
  };

  const handleDelete = async (id: string, isOffline: boolean) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    setError(null);

    try {
      if (isOffline) {
        // Delete from offline queue and local cache
        await IDBHelper.delete('offline_expenses', id);
        await IDBHelper.delete('expenses', id);
        loadExpensesQueue();
      } else if (isOnline) {
        // Delete from backend API
        await apiClient.delete(`/expenses/${id}`);
        await IDBHelper.delete('expenses', id);
      } else {
        setError('Cannot delete online records while offline.');
        return;
      }
      
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      console.error('Failed to delete expense:', err);
      setError('Could not delete expense from server.');
    }
  };

  // Helper calculations
  const totalAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const categoryBreakdown = CATEGORIES.map(cat => {
    const sum = expenses
      .filter(e => e.category === cat.id)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    return { ...cat, total: sum };
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-md border-b border-brand-900/30 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="p-2 hover:bg-brand-900/20 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Expense Tracker
            </h1>
            <p className="text-xs text-gray-400">Manage business expenses</p>
          </div>
        </div>

        {/* Network Connection Indicator */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium animate-pulse">
              <WifiOff className="w-3.5 h-3.5" /> Offline Mode
            </span>
          )}
        </div>
      </div>

      {/* Main Content container */}
      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
        {/* Error Notification */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Main Stats Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1424] to-[#0a101b] border border-brand-900/30 p-6 shadow-[0_0_20px_rgba(0,50,41,0.15)]">
          <div className="relative z-10 space-y-2">
            <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Total Expenses logged</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-white">₹{totalAmount.toLocaleString('en-IN')}</span>
              <span className="text-xs text-emerald-400 font-medium">This month</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">{expenses.length} transaction entries</p>
          </div>
          {/* Accent Glow */}
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Quick actions row */}
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-900 to-emerald-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,50,41,0.25)] hover:shadow-[0_4px_15px_rgba(0,50,41,0.4)] transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" /> Add New Expense
        </button>

        {/* Category Breakdown list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Category Breakdown</h2>
          <div className="grid grid-cols-2 gap-3">
            {categoryBreakdown.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="bg-[#0c1424] border border-brand-900/10 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-gray-300 truncate">{cat.name}</span>
                  </div>
                  <span className="text-sm font-bold text-white mt-2">₹{cat.total.toLocaleString('en-IN')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Expense Logs</h2>
            {loading && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
          </div>

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="bg-[#0c1424] border border-brand-900/20 rounded-2xl p-8 text-center text-gray-400">
                <p className="text-sm">No expenses logged yet.</p>
                <p className="text-xs text-gray-500 mt-1">Tap the button above to add one.</p>
              </div>
            ) : (
              expenses.map((expense) => {
                const isOffline = offlineExpenses.some(o => o.id === expense.id);
                const categoryConfig = CATEGORIES.find(c => c.id === expense.category);
                const IconComponent = categoryConfig?.icon || IndianRupee;

                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-[#0c1424] border border-brand-900/10 hover:border-brand-900/40 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${categoryConfig?.color || 'text-slate-400 border-slate-400/20 bg-slate-400/10'}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-200">{expense.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-semibold">{expense.expenseDate}</span>
                          {isOffline && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full font-bold">
                              Queued
                            </span>
                          )}
                        </div>
                        {expense.remarks && (
                          <p className="text-xs text-gray-500 italic mt-1 truncate max-w-[200px]">"{expense.remarks}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-base font-extrabold text-white">₹{Number(expense.amount).toLocaleString('en-IN')}</span>
                      <button
                        onClick={() => handleDelete(expense.id, isOffline)}
                        className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          {/* Clickaway backdrop */}
          <div className="absolute inset-0" onClick={() => setShowAddForm(false)} />
          
          <div className="relative w-full max-w-md bg-[#0a101b] border-t border-brand-900/40 rounded-t-3xl p-6 space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-white">Add Expense</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Expense Title *</label>
                <input
                  type="text"
                  placeholder="e.g. CA Professional Fees, Packing Materials"
                  className="w-full bg-[#0c1424] border border-brand-900/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-[#0c1424] border border-brand-900/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                  {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be greater than 0' } })}
                />
                {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
              </div>

              {/* Category dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Category *</label>
                <select
                  className="w-full bg-[#0c1424] border border-brand-900/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                  {...register('category', { required: 'Category is required' })}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
              </div>

              {/* Expense Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Expense Date</label>
                <input
                  type="date"
                  className="w-full bg-[#0c1424] border border-brand-900/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                  {...register('expenseDate')}
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Remarks (Optional)</label>
                <textarea
                  placeholder="Any extra details..."
                  className="w-full bg-[#0c1424] border border-brand-900/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 h-20"
                  {...register('remarks')}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-900 to-emerald-700 hover:from-emerald-700 hover:to-brand-900 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
              >
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
