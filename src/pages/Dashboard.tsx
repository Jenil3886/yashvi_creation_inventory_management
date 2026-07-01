import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Boxes,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  Package,
  History,
  Barcode,
} from "lucide-react";
import useOfflineStore from "../store/useOfflineStore";
import apiClient from "../services/apiClient";
import { IDBHelper } from "../utils/idbHelper";

interface SummaryData {
  todayPurchase: number;
  currentMonthPurchase: number;
  inventoryValue: number;
  lowStockCount: number;
  recentPurchases: any[];
  lowStockProducts: any[];
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isOnline, offlineQueue } = useOfflineStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryData>({
    todayPurchase: 0,
    currentMonthPurchase: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    recentPurchases: [],
    lowStockProducts: [],
  });

  // Query lock ref to prevent duplicate/concurrent API requests
  const fetchingRef = useRef(false);

  const loadData = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // 1. Immediately load and render dashboard data from local cache
    const cachedDashboardRaw = await IDBHelper.get(
      "settings",
      "cached_dashboard",
    );
    if (cachedDashboardRaw) {
      try {
        setData(JSON.parse(cachedDashboardRaw.value));
        setLoading(false); // Disable spinner immediately
      } catch (e) {
        console.error("Error parsing dashboard cache:", e);
      }
    } else {
      setLoading(true);
    }

    // 2. Fetch fresh dashboard summary from API in background if online
    if (isOnline) {
      try {
        // Fetch from API
        const res = await apiClient.get("/reports/dashboard-summary");
        const summary = res.data.data;
        setData(summary);

        // Cache master data in IndexedDB
        await IDBHelper.put("settings", {
          key: "cached_dashboard",
          value: JSON.stringify(summary),
        });

        // Background update master caches while online
        try {
          const prodRes = await apiClient.get("/products");
          await IDBHelper.putAll("products", prodRes.data.data);

          const catRes = await apiClient.get("/categories");
          await IDBHelper.putAll("categories", catRes.data.data);

          const supRes = await apiClient.get("/suppliers");
          await IDBHelper.putAll("suppliers", supRes.data.data);
        } catch (e) {
          console.warn("Silent master sync warning:", e);
        }
      } catch (err) {
        console.error(
          "Failed fetching online dashboard, using local fallback:",
          err,
        );
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    } else {
      // Offline mode calculations
      await loadFromLocalCache();
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const loadFromLocalCache = async () => {
    try {
      // Load products from IndexedDB to compute inventory value and low stock
      const localProducts = await IDBHelper.getAll("products");
      const queuedPurchases = await IDBHelper.getAll("offline_purchases");

      const cachedDashboardRaw = await IDBHelper.get(
        "settings",
        "cached_dashboard",
      );
      let cachedDashboard: SummaryData = {
        todayPurchase: 0,
        currentMonthPurchase: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        recentPurchases: [],
        lowStockProducts: [],
      };

      if (cachedDashboardRaw) {
        try {
          cachedDashboard = JSON.parse(cachedDashboardRaw.value);
        } catch {}
      }

      // 1. Calculate Inventory Valuation from IndexedDB Products
      const computedInventoryValue = localProducts.reduce(
        (sum: number, p: any) => {
          const stock = p.currentStock || 0;
          const price = parseFloat(p.purchasePrice || 0);
          return sum + stock * price;
        },
        0,
      );

      // 2. Count low stock products locally
      const computedLowStockProducts = localProducts.filter(
        (p: any) => p.active && (p.currentStock || 0) <= 5,
      );

      // 3. Today's Purchases (offline additions + cached values)
      const today = new Date().toISOString().split("T")[0];
      const todayOfflineAmt = queuedPurchases.reduce(
        (sum: number, invoice: any) => {
          const date = invoice.purchaseDate.split("T")[0];
          return date === today ? sum + invoice.totalAmount : sum;
        },
        0,
      );

      // 4. Month Purchases
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthOfflineAmt = queuedPurchases.reduce(
        (sum: number, invoice: any) => {
          const invoiceDate = new Date(invoice.purchaseDate);
          return invoiceDate.getMonth() === currentMonth &&
            invoiceDate.getFullYear() === currentYear
            ? sum + invoice.totalAmount
            : sum;
        },
        0,
      );

      // Merge results
      setData({
        todayPurchase: cachedDashboard.todayPurchase + todayOfflineAmt,
        currentMonthPurchase:
          cachedDashboard.currentMonthPurchase + monthOfflineAmt,
        inventoryValue:
          computedInventoryValue || cachedDashboard.inventoryValue,
        lowStockCount: computedLowStockProducts.length,
        recentPurchases: queuedPurchases
          .concat(cachedDashboard.recentPurchases)
          .slice(0, 5),
        lowStockProducts: computedLowStockProducts.slice(0, 5),
      });
    } catch (e) {
      console.error("Failed computing offline metrics", e);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOnline]);

  const stats = [
    {
      title: "Today's Purchases",
      value: `₹${data.todayPurchase.toLocaleString("en-IN")}`,
      icon: TrendingUp,
      color: "bg-brand-500 text-white",
      textColor: "text-brand-600 dark:text-brand-400",
    },
    {
      title: "Current Month",
      value: `₹${data.currentMonthPurchase.toLocaleString("en-IN")}`,
      icon: FileSpreadsheet,
      color: "bg-indigo-500 text-white",
      textColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      title: "Inventory Valuation",
      value: `₹${data.inventoryValue.toLocaleString("en-IN")}`,
      icon: Boxes,
      color: "bg-emerald-500 text-white",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold animate-pulse">
          <AlertTriangle size={15} />
          <span>
            Offline Mode. Valuation calculated from device cache. Invoices
            queued locally.
          </span>
        </div>
      )}

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-white dark:bg-darkCard rounded-2xl border border-slate-100 dark:border-darkBorder shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
            >
              <div className="space-y-1">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  {stat.title}
                </span>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">
                  {loading ? "..." : stat.value}
                </p>
              </div>
              <div
                className={`p-3 rounded-2xl ${stat.textColor} bg-slate-50 dark:bg-slate-800/40`}
              >
                <Icon size={24} className="stroke-[2]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Drawer Section */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/purchase-entry")}
            className="flex flex-col items-center justify-center p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all active:scale-[0.97]"
          >
            <PlusCircle size={22} className="text-brand-500 mb-2" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              New Purchase
            </span>
          </button>
          <button
            onClick={() => navigate("/products")}
            className="flex flex-col items-center justify-center p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all active:scale-[0.97]"
          >
            <Package size={22} className="text-emerald-500 mb-2" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Add Product
            </span>
          </button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {data.lowStockCount > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertTriangle size={18} className="stroke-[2.5]" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Low Stock Warning ({data.lowStockCount})
              </h3>
            </div>
            <button
              onClick={() => navigate("/products?lowStock=true")}
              className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 underline uppercase"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-red-100/50 dark:divide-red-900/10">
            {data.lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={p.imageUrl || "/assets/placeholder-product.png"}
                    alt={p.name}
                    className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    }}
                  />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {p.sku}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 rounded text-[10px]">
                    Stock: {p.currentStock || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Purchases List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Recent Purchases
          </h2>
          <button
            onClick={() => navigate("/history")}
            className="text-[10px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-wider hover:underline"
          >
            History
          </button>
        </div>

        <div className="bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl divide-y divide-slate-100 dark:divide-darkBorder overflow-hidden">
          {data.recentPurchases.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No recent purchases logged.
            </div>
          ) : (
            data.recentPurchases.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate("/history")}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 rounded-xl">
                    <History size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        #{inv.invoiceNumber}
                      </p>
                      {inv.id.startsWith("offline_") && (
                        <span className="text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Queued
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                      {inv.supplier?.name ||
                        inv.supplierName ||
                        "Unknown Supplier"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-xs text-slate-800 dark:text-slate-200">
                    ₹
                    {parseFloat(inv.totalAmount.toString()).toLocaleString(
                      "en-IN",
                    )}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    {inv.totalQuantity} items
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
