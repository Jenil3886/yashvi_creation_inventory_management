import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  AlertTriangle,
  PackageOpen,
  Calendar,
  Calculator,
  ChevronDown,
  Search,
} from 'lucide-react';
import useOfflineStore from '../store/useOfflineStore';
import apiClient from '../services/apiClient';
import { IDBHelper } from '../utils/idbHelper';

const defaultProductImg = '/pwa-192x192.png';

interface Product {
  id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  currentStock: number;
  imageUrl: string;
  categoryId: string;
  active: boolean;
  category: { name: string };
}

interface Supplier {
  id: string;
  name: string;
  status: string;
}

export const PurchaseEntry: React.FC = () => {
  const navigate = useNavigate();
  const { isOnline, enqueuePurchase } = useOfflineStore();

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // 3-Field Form States
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Custom searchable dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load master data
  const loadMasterData = async () => {
    try {
      const cachedProducts = await IDBHelper.getAll<Product>('products');
      const cachedSuppliers = await IDBHelper.getAll<Supplier>('suppliers');

      setProducts(cachedProducts.filter((p) => p.active));

      const activeSuppliers = cachedSuppliers.filter((s) => s.status === 'ACTIVE');
      setSuppliers(activeSuppliers);

      // Auto select first supplier
      if (activeSuppliers.length > 0) {
        setSelectedSupplierId(activeSuppliers[0].id);
      }
    } catch (e) {
      console.error('Failed loading autocomplete data:', e);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Filter dropdown products
  const filteredDropdownProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()),
  );

  // Calculate quick price summary on selection
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const calculatedTotal = selectedProduct
    ? (parseFloat(selectedProduct.purchasePrice.toString()) || 0) * (parseInt(quantity) || 0)
    : 0;

  // Save submit handler
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      setErrorMsg('Please select a product.');
      return;
    }
    const qtyNum = parseInt(quantity);
    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg('Please enter a valid quantity greater than 0.');
      return;
    }
    if (!selectedSupplierId) {
      setErrorMsg('No active supplier found. Please create a supplier in settings first.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const product = products.find((p) => p.id === selectedProductId)!;
    const price = parseFloat(product.purchasePrice.toString());

    // Auto-generate invoice/transaction parameters
    const timestamp = Date.now();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `YC-PUR-${timestamp}-${randomNum}`;
    const formattedDate = new Date(purchaseDate).toISOString();

    const invoicePayload = {
      invoiceNumber,
      purchaseDate: formattedDate,
      supplierId: selectedSupplierId,
      items: [
        {
          productId: selectedProductId,
          quantity: qtyNum,
          purchasePrice: price,
        },
      ],
    };

    if (isOnline) {
      try {
        // Submit immediately online
        await apiClient.post('/purchases', invoicePayload);
        navigate('/'); // redirect to home
      } catch (err: any) {
        console.error('Invoice submit error:', err);
        setErrorMsg(err.response?.data?.message || 'Error occurred while saving purchase.');
        setSubmitting(false);
      }
    } else {
      // Offline enqueue
      try {
        const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

        const offlinePayload = {
          id: `offline_${timestamp}`,
          invoiceNumber,
          purchaseDate: formattedDate,
          supplierId: selectedSupplierId,
          supplierName: selectedSupplier?.name || 'Local Supplier',
          items: [
            {
              productId: selectedProductId,
              productName: product.name,
              sku: product.sku,
              imageUrl: product.imageUrl,
              quantity: qtyNum,
              purchasePrice: price,
              subtotal: calculatedTotal,
            },
          ],
          totalAmount: calculatedTotal,
          totalQuantity: qtyNum,
          createdAt: formattedDate,
        };

        // Queue in IndexedDB and adjust local stock counts immediately!
        await enqueuePurchase(offlinePayload);
        navigate('/'); // redirect back home
      } catch (err: any) {
        console.error('Offline save error:', err);
        setErrorMsg('Could not save offline purchase queue.');
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Offline Status */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold animate-pulse">
          <AlertTriangle size={15} />
          <span>
            Offline Mode. Purchase will be enqueued locally and stock updated immediately.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Main 3-Field Form Card */}
      <div className="bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.015)] p-5">
        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-5 flex items-center gap-2">
          <PackageOpen size={18} className="text-brand-500" />
          <span>Log Purchase</span>
        </h2>

        <form onSubmit={handleSavePurchase} className="space-y-5">
          {/* FIELD 1: PRODUCT DROPDOWN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              Product *
            </label>
            <div className="relative">
              {/* Dropdown Toggle Button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs text-left text-slate-700 dark:text-slate-200 font-bold focus:outline-none transition-all active:scale-[0.99] shadow-sm"
              >
                <span>
                  {selectedProduct
                    ? `${selectedProduct.name} (${selectedProduct.sku}) — ₹${selectedProduct.purchasePrice}`
                    : 'Select Product'}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Click-away backdrop */}
              {isDropdownOpen && (
                <div
                  className="fixed inset-0 z-30 bg-transparent"
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}

              {/* Dropdown Panel Menu */}
              {isDropdownOpen && (
                <div className="absolute z-40 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-slide-up">
                  {/* Search filter inside dropdown */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-2">
                    <Search size={12} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product name or SKU..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400"
                    />
                  </div>

                  {/* List of matching products */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDropdownProducts.length === 0 ? (
                      <div className="p-3.5 text-center text-xs text-slate-400">
                        No active products found
                      </div>
                    ) : (
                      filteredDropdownProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setIsDropdownOpen(false);
                            setProductSearch('');
                          }}
                          className="p-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 flex justify-between items-center transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={p.imageUrl || defaultProductImg}
                              alt={p.name}
                              className="w-8 h-8 object-cover bg-slate-100 dark:bg-slate-800 rounded-lg"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = defaultProductImg;
                              }}
                            />
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">
                                {p.name}
                              </p>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                {p.sku}
                              </p>
                            </div>
                          </div>
                          <span className="font-black text-brand-500 dark:text-brand-400">
                            ₹{parseFloat(p.purchasePrice.toString()).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FIELD 2: QUANTITY INPUT */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-3.5 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100 font-bold"
            />
          </div>

          {/* FIELD 3: DATE INPUT (Pre-filled to today) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={13} />
              <span>Date *</span>
            </label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3.5 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
          </div>

          {/* Read-only Cost estimation Box */}
          {selectedProduct && (
            <div className="p-4 bg-slate-50 dark:bg-darkBg/60 border border-slate-100 dark:border-darkBorder/40 rounded-xl flex items-center justify-between text-xs animate-slide-up">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <Calculator size={15} />
                <span>Total Expenditure:</span>
              </div>
              <span className="font-black text-brand-500 dark:text-brand-400 text-sm">
                ₹{calculatedTotal.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
          >
            <Save size={16} />
            <span>{submitting ? 'Saving...' : 'Save Purchase'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default PurchaseEntry;
