import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Calendar,
  Filter,
  Eye,
  Trash2,
  AlertTriangle,
  FolderOpen,
  FileText,
} from "lucide-react";
import useOfflineStore from "../store/useOfflineStore";
import apiClient from "../services/apiClient";
import { IDBHelper } from "../utils/idbHelper";
import Drawer from "../components/Drawer";

const defaultProductImg = "/pwa-192x192.png";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  supplierId: string;
  remarks?: string;
  totalAmount: number;
  totalQuantity: number;
  createdAt: string;
  supplier: { name: string; gstNumber?: string };
  items: {
    id: string;
    quantity: number;
    purchasePrice: number;
    subtotal: number;
    product: {
      name: string;
      sku: string;
      imageUrl: string;
      category: { name: string };
    };
  }[];
}

interface Supplier {
  id: string;
  name: string;
}

export const PurchaseHistory: React.FC = () => {
  const { isOnline } = useOfflineStore();

  // Invoices & Autocomplete master data
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<PurchaseInvoice[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  // Query lock ref to prevent duplicate/concurrent API requests
  const fetchingRef = useRef(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Detail view state
  const [selectedInvoice, setSelectedInvoice] =
    useState<PurchaseInvoice | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [undoing, setUndoing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setErrorMsg(null);

    // 1. Immediately load and render transaction history from local cache
    const cachedHistoryRaw = await IDBHelper.get("settings", "cached_history");
    const cachedSuppliers = await IDBHelper.getAll<Supplier>("suppliers");

    if (cachedSuppliers.length > 0 || cachedHistoryRaw) {
      setSuppliers(cachedSuppliers);
      if (cachedHistoryRaw) {
        try {
          setInvoices(JSON.parse(cachedHistoryRaw.value));
        } catch (e) {
          console.error("Error parsing history cache:", e);
        }
      }
      setLoading(false); // Stop loading spinner immediately
    } else {
      setLoading(true);
    }

    // 2. Fetch fresh invoices from API in background if online
    if (isOnline) {
      try {
        const invRes = await apiClient.get("/purchases");
        const supRes = await apiClient.get("/suppliers");

        setInvoices(invRes.data.data);
        setSuppliers(supRes.data.data);

        // Cache invoices locally for offline viewing
        await IDBHelper.put("settings", {
          key: "cached_history",
          value: JSON.stringify(invRes.data.data),
        });
        await IDBHelper.putAll("suppliers", supRes.data.data);
      } catch (err) {
        console.error(
          "Failed fetching history online, using local cache:",
          err,
        );
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    } else {
      await loadFromLocal();
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const loadFromLocal = async () => {
    try {
      const cachedHistoryRaw = await IDBHelper.get(
        "settings",
        "cached_history",
      );
      const cachedSuppliers = await IDBHelper.getAll<Supplier>("suppliers");

      setSuppliers(cachedSuppliers);

      if (cachedHistoryRaw) {
        setInvoices(JSON.parse(cachedHistoryRaw.value));
      } else {
        setInvoices([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOnline]);

  // Apply filters locally in real time
  useEffect(() => {
    let result = [...invoices];

    // Search query: Invoice Number or Product Name
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.supplier?.name.toLowerCase().includes(q) ||
          inv.items.some(
            (item) =>
              item.product.name.toLowerCase().includes(q) ||
              item.product.sku.toLowerCase().includes(q),
          ),
      );
    }

    // Supplier filter
    if (selectedSupplierId) {
      result = result.filter((inv) => inv.supplierId === selectedSupplierId);
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((inv) => new Date(inv.purchaseDate) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((inv) => new Date(inv.purchaseDate) <= end);
    }

    setFilteredInvoices(result);
  }, [searchQuery, selectedSupplierId, startDate, endDate, invoices]);

  // Open invoice detail drawer
  const handleOpenDetails = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDrawerOpen(true);
  };

  // Perform invoice undo rollback
  const handleUndoInvoice = async (invoiceId: string) => {
    if (!isOnline) {
      alert(
        "You must be online to undo purchases and sync stock rollbacks with the server.",
      );
      return;
    }

    const confirmUndo = window.confirm(
      "Are you sure you want to UNDO this purchase? This will delete the invoice record and decrement current product stock levels.",
    );
    if (!confirmUndo) return;

    setUndoing(true);
    try {
      await apiClient.delete(`/purchases/${invoiceId}/undo`);
      setIsDetailDrawerOpen(false);
      setSelectedInvoice(null);
      await loadData(); // Reload list
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to undo invoice.");
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            placeholder="Search Inv No, Supplier, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-darkCard border border-slate-200 dark:border-darkBorder rounded-2xl text-xs focus:outline-none focus:border-brand-500 dark:focus:border-brand-400 dark:text-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.015)]"
          />
        </div>

        <button
          onClick={() => setShowFiltersDrawer(true)}
          className={`p-3 rounded-2xl border transition-all active:scale-95 ${
            selectedSupplierId || startDate || endDate
              ? "bg-brand-500 border-brand-500 text-white shadow-lg"
              : "bg-white dark:bg-darkCard border-slate-200 dark:border-darkBorder text-slate-500 dark:text-slate-400"
          }`}
          title="History Filters"
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Offline Status */}
      {!isOnline && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
          Offline Mode. History is loaded from cached snapshots. Undo action is
          disabled.
        </div>
      )}

      {/* Filter Chips Display */}
      {(selectedSupplierId || startDate || endDate) && (
        <div className="flex flex-wrap gap-2 px-1">
          {selectedSupplierId && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
              Supplier:{" "}
              {suppliers.find((s) => s.id === selectedSupplierId)?.name ||
                "Unknown"}
              <button
                onClick={() => setSelectedSupplierId("")}
                className="hover:text-red-500 font-bold ml-1"
              >
                ×
              </button>
            </span>
          )}
          {(startDate || endDate) && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
              Date: {startDate || "Start"} to {endDate || "End"}
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="hover:text-red-500 font-bold ml-1"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Invoice List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-xs">No purchase history records found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              onClick={() => handleOpenDetails(inv)}
              className="flex items-center justify-between p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:bg-slate-50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Invoice #{inv.invoiceNumber}
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                    Supplier: {inv.supplier?.name || "Unknown"}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold mt-1">
                    {new Date(inv.purchaseDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right flex items-center gap-4">
                <div>
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
                <span className="p-1.5 bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 rounded-lg">
                  <Eye size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTER DRAWER BOTTOM SHEET */}
      <Drawer
        isOpen={showFiltersDrawer}
        onClose={() => setShowFiltersDrawer(false)}
        title="Filter History"
      >
        <div className="space-y-4">
          {/* Supplier select */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Supplier
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-200"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Start Date
            </label>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-200"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              End Date
            </label>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-200"
              />
            </div>
          </div>

          <button
            onClick={() => setShowFiltersDrawer(false)}
            className="w-full py-3 bg-brand-500 text-white font-bold rounded-xl shadow-md text-xs uppercase"
          >
            Apply Filters
          </button>
        </div>
      </Drawer>

      {/* INVOICE DETAILS & UNDO ACTION SHEET */}
      <Drawer
        isOpen={isDetailDrawerOpen && !!selectedInvoice}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={
          selectedInvoice
            ? `Invoice details: #${selectedInvoice.invoiceNumber}`
            : ""
        }
      >
        {selectedInvoice && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="p-3 bg-slate-50 dark:bg-darkBg border border-slate-100 dark:border-darkBorder rounded-xl text-xs grid grid-cols-2 gap-y-2">
              <span className="text-slate-400">Supplier:</span>
              <span className="font-bold text-right text-slate-800 dark:text-slate-200">
                {selectedInvoice.supplier?.name}
              </span>

              <span className="text-slate-400">GST Number:</span>
              <span className="font-bold text-right text-slate-800 dark:text-slate-200">
                {selectedInvoice.supplier?.gstNumber || "N/A"}
              </span>

              <span className="text-slate-400">Purchase Date:</span>
              <span className="font-bold text-right text-slate-800 dark:text-slate-200">
                {new Date(selectedInvoice.purchaseDate).toLocaleDateString(
                  "en-IN",
                )}
              </span>

              <span className="text-slate-400">Remarks:</span>
              <span className="font-bold text-right text-slate-800 dark:text-slate-200">
                {selectedInvoice.remarks || "None"}
              </span>
            </div>

            {/* Itemized Table */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Product Items ({selectedInvoice.items.length})
              </h4>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-darkBorder bg-slate-50/50 dark:bg-darkBg/30 border border-slate-100 dark:border-darkBorder rounded-xl p-2">
                {selectedInvoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={item.product?.imageUrl || defaultProductImg}
                        alt={item.product?.name}
                        className="w-8 h-8 object-cover bg-slate-200 dark:bg-slate-800 rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            defaultProductImg;
                        }}
                      />
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {item.product?.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {item.product?.sku}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-700 dark:text-slate-300">
                        ₹
                        {parseFloat(item.subtotal.toString()).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {item.quantity} pcs @ ₹
                        {parseFloat(
                          item.purchasePrice.toString(),
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-between items-center text-xs p-3.5 bg-brand-50 dark:bg-brand-950/20 border border-brand-200/20 rounded-xl">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                  Total Items
                </span>
                <span className="font-extrabold text-slate-700 dark:text-slate-300">
                  {selectedInvoice.totalQuantity} pcs
                </span>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                  Invoice Sum
                </span>
                <span className="font-black text-sm text-brand-500 dark:text-brand-400">
                  ₹
                  {parseFloat(
                    selectedInvoice.totalAmount.toString(),
                  ).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Rollback Undo Actions */}
            {isOnline && (
              <button
                type="button"
                onClick={() => handleUndoInvoice(selectedInvoice.id)}
                disabled={undoing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 hover:bg-red-200 text-red-600 font-bold rounded-xl text-xs transition-colors active:scale-95"
              >
                <Trash2 size={16} />
                <span>
                  {undoing ? "Rolling Back..." : "Undo Purchase (Rollback)"}
                </span>
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PurchaseHistory;
