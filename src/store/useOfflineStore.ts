import { create } from 'zustand';
import { IDBHelper } from '../utils/idbHelper';
import apiClient from '../services/apiClient';

interface OfflinePurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  subtotal: number;
}

interface OfflinePurchase {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  supplierId: string;
  supplierName: string;
  remarks?: string;
  items: OfflinePurchaseItem[];
  totalAmount: number;
  totalQuantity: number;
  createdAt: string;
}

export interface OfflineExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  remarks?: string;
  createdAt: string;
}

interface OfflineState {
  isOnline: boolean;
  offlineQueue: OfflinePurchase[];
  offlineExpenses: OfflineExpense[];
  isSyncing: boolean;
  setOnlineStatus: (status: boolean) => void;
  loadQueue: () => Promise<void>;
  loadExpensesQueue: () => Promise<void>;
  enqueuePurchase: (purchase: OfflinePurchase) => Promise<void>;
  enqueueExpense: (expense: OfflineExpense) => Promise<void>;
  syncQueue: () => Promise<void>;
  syncExpenses: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineQueue: [],
  offlineExpenses: [],
  isSyncing: false,

  setOnlineStatus: (status: boolean) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: status });
    // Trigger sync automatically when transitioning back online
    if (status && wasOffline) {
      get().syncQueue();
      get().syncExpenses();
    }
  },

  loadQueue: async () => {
    const queue = await IDBHelper.getAll<OfflinePurchase>('offline_purchases');
    set({ offlineQueue: queue });
  },

  loadExpensesQueue: async () => {
    const queue = await IDBHelper.getAll<OfflineExpense>('offline_expenses');
    set({ offlineExpenses: queue });
  },

  enqueuePurchase: async (purchase: OfflinePurchase) => {
    // 1. Save in IndexedDB
    await IDBHelper.put('offline_purchases', purchase);

    // 2. Adjust local product stock values in IndexedDB cache to reflect the purchase immediately!
    for (const item of purchase.items) {
      const localProduct = await IDBHelper.get('products', item.productId);
      if (localProduct) {
        localProduct.currentStock = (localProduct.currentStock || 0) + item.quantity;
        await IDBHelper.put('products', localProduct);
      }
    }

    // 3. Mark backend settings as backupPending
    const backupSettings = { key: 'backupPending', value: 'true' };
    await IDBHelper.put('settings', backupSettings);

    // 4. Refresh local store queue list
    await get().loadQueue();
  },

  enqueueExpense: async (expense: OfflineExpense) => {
    // 1. Save in IndexedDB offline_expenses queue
    await IDBHelper.put('offline_expenses', expense);

    // 2. Put in expenses cache so the UI shows it immediately
    await IDBHelper.put('expenses', expense);

    // 3. Mark backend settings as backupPending
    const backupSettings = { key: 'backupPending', value: 'true' };
    await IDBHelper.put('settings', backupSettings);

    // 4. Refresh local store queue list
    await get().loadExpensesQueue();
  },

  syncQueue: async () => {
    const { isOnline, isSyncing, offlineQueue } = get();
    if (!isOnline || isSyncing || offlineQueue.length === 0) return;

    set({ isSyncing: true });
    const queueCopy = [...offlineQueue];

    for (const invoice of queueCopy) {
      try {
        const apiPayload = {
          invoiceNumber: invoice.invoiceNumber,
          purchaseDate: invoice.purchaseDate,
          supplierId: invoice.supplierId,
          remarks: invoice.remarks,
          items: invoice.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            purchasePrice: i.purchasePrice,
          })),
        };

        // Post purchase to backend
        await apiClient.post('/purchases', apiPayload);

        // Delete from IndexedDB upon successful upload
        await IDBHelper.delete('offline_purchases', invoice.id);
      } catch (error: any) {
        // If invoice is already submitted on server, clean from local queue
        if (
          error.response?.data?.message?.includes('already exists') ||
          error.response?.status === 400
        ) {
          await IDBHelper.delete('offline_purchases', invoice.id);
        } else {
          // Keep item in queue and halt if connection breaks again
          console.warn('Sync failed on invoice, postponing remaining queue:', error);
          break;
        }
      }
    }

    // Reload queue and clear syncing state
    await get().loadQueue();
    set({ isSyncing: false });
  },

  syncExpenses: async () => {
    const { isOnline, isSyncing, offlineExpenses } = get();
    if (!isOnline || isSyncing || offlineExpenses.length === 0) return;

    set({ isSyncing: true });
    const queueCopy = [...offlineExpenses];

    for (const exp of queueCopy) {
      try {
        const apiPayload = {
          title: exp.title,
          amount: exp.amount,
          category: exp.category,
          expenseDate: exp.expenseDate,
          remarks: exp.remarks,
        };

        // Post expense to backend
        await apiClient.post('/expenses', apiPayload);

        // Delete from IndexedDB queue upon successful upload
        await IDBHelper.delete('offline_expenses', exp.id);
      } catch (error: any) {
        console.warn('Sync failed on expense, postponing remaining queue:', error);
        break;
      }
    }

    // Reload queue and clear syncing state
    await get().loadExpensesQueue();
    set({ isSyncing: false });
  },
}));

// Set up window listeners to catch internet reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnlineStatus(true);
  });
  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnlineStatus(false);
  });
}

export default useOfflineStore;
