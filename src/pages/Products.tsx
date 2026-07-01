import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderOpen,
  Filter,
  PackageCheck,
  Image as ImageIcon,
} from "lucide-react";
import useOfflineStore from "../store/useOfflineStore";
import apiClient from "../services/apiClient";
import { IDBHelper } from "../utils/idbHelper";
import Drawer from "../components/Drawer";

const defaultProductImg = "/pwa-192x192.png";

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

interface Category {
  id: string;
  name: string;
}

export const Products: React.FC = () => {
  const { isOnline } = useOfflineStore();
  const [searchParams] = useSearchParams();

  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Query lock ref to prevent duplicate/concurrent API requests
  const fetchingRef = useRef(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(
    searchParams.get("lowStock") === "true",
  );
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Drawer Form States
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load products and categories with Stale-While-Revalidate (SWR) caching
  const loadData = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // 1. Immediately render cached data from IndexedDB (under 5ms) to avoid loading spinner
    const cachedProds = await IDBHelper.getAll<Product>("products");
    const cachedCats = await IDBHelper.getAll<Category>("categories");

    if (cachedProds.length > 0 || cachedCats.length > 0) {
      setProducts(cachedProds);
      setCategories(cachedCats);
      setLoading(false); // Stop loading spinner immediately
    } else {
      setLoading(true); // Only show spinner if cache is completely empty
    }

    // 2. Fetch fresh data from API in background if online
    if (isOnline) {
      try {
        const prodRes = await apiClient.get("/products");
        const catRes = await apiClient.get("/categories");

        const prods = prodRes.data.data;
        const cats = catRes.data.data;

        setProducts(prods);
        setCategories(cats);

        // Update IndexedDB cache
        await IDBHelper.clear("products");
        await IDBHelper.putAll("products", prods);
        await IDBHelper.clear("categories");
        await IDBHelper.putAll("categories", cats);
      } catch (err) {
        console.error("Failed fetching online products, using cache:", err);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    } else {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const loadFromLocal = async () => {
    const cachedProds = await IDBHelper.getAll<Product>("products");
    const cachedCats = await IDBHelper.getAll<Category>("categories");
    setProducts(cachedProds);
    setCategories(cachedCats);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }
    try {
      setLoading(true);
      await apiClient.delete(`/products/${id}`);
      await loadData();
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      alert(
        err.response?.data?.message || "Error occurred while deleting product.",
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOnline]);

  // Apply filters locally in real time
  useEffect(() => {
    let result = [...products];

    // Search term matching
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term),
      );
    }

    // Category filter
    if (selectedCategory !== "") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    // Low stock filter (Stock <= 5 units)
    if (filterLowStock) {
      result = result.filter((p) => p.active && (p.currentStock || 0) <= 5);
    }

    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, filterLowStock, products]);

  // Handle open Form drawer for ADD
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategoryId(categories[0]?.id || "");
    setFormPrice("");
    setFormActive(true);
    setFormImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setIsFormDrawerOpen(true);
  };

  // Handle open Form drawer for EDIT
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategoryId(p.categoryId);
    setFormPrice(p.purchasePrice.toString());
    setFormActive(p.active);
    setFormImageFile(null);
    setImagePreview(p.imageUrl);
    setFormError(null);
    setIsFormDrawerOpen(true);
  };

  // Handle Image preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form Submit Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setFormError(
        "You must be online to create or update product master details.",
      );
      return;
    }

    if (!formName || !formCategoryId || !formPrice) {
      setFormError("Please fill in all mandatory fields.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("name", formName.trim());
      formData.append("categoryId", formCategoryId);
      formData.append("purchasePrice", formPrice);
      formData.append("active", String(formActive));

      if (formImageFile) {
        formData.append("image", formImageFile);
      }

      let response;
      if (editingProduct) {
        // PUT
        response = await apiClient.put(
          `/products/${editingProduct.id}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } else {
        // POST
        response = await apiClient.post("/products", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      if (response.data.status === "success") {
        setIsFormDrawerOpen(false);
        loadData(); // reload
      } else {
        setFormError("Action failed.");
      }
    } catch (err: any) {
      console.error(err);
      setFormError(
        err.response?.data?.message || "Error occurred while saving product.",
      );
    } finally {
      setSubmitting(false);
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
            placeholder="Search Name, SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-darkCard border border-slate-200 dark:border-darkBorder rounded-2xl text-xs focus:outline-none focus:border-brand-500 dark:focus:border-brand-400 dark:text-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.015)]"
          />
        </div>
        <button
          onClick={() => setShowFiltersDrawer(true)}
          className={`p-3 rounded-2xl border transition-all active:scale-95 ${
            selectedCategory || filterLowStock
              ? "bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-white dark:bg-darkCard border-slate-200 dark:border-darkBorder text-slate-500 dark:text-slate-400"
          }`}
          title="Filter Options"
        >
          <Filter size={18} />
        </button>

        {isOnline && (
          <button
            onClick={handleOpenAdd}
            className="p-3 bg-brand-500 text-white rounded-2xl hover:bg-brand-600 active:scale-95 transition-all shadow-md glow-brand"
            title="Add Product"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Online indicator */}
      {!isOnline && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
          Offline Mode. Editing/Adding products is disabled.
        </div>
      )}

      {/* Active filters display */}
      {(selectedCategory || filterLowStock) && (
        <div className="flex flex-wrap gap-2 px-1">
          {selectedCategory && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
              Category:{" "}
              {categories.find((c) => c.id === selectedCategory)?.name ||
                "Unknown"}
              <button
                onClick={() => setSelectedCategory("")}
                className="hover:text-red-500 font-bold ml-1"
              >
                ×
              </button>
            </span>
          )}
          {filterLowStock && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300 px-2 py-1 rounded-full border border-red-200/20">
              Low Stock Alert (≤ 5)
              <button
                onClick={() => setFilterLowStock(false)}
                className="hover:text-red-500 font-bold ml-1"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Products list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-xs">No products match your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredProducts.map((p) => {
            const isLowStock = p.active && (p.currentStock || 0) <= 5;

            return (
              <div
                key={p.id}
                className={`relative flex items-center justify-between p-3.5 bg-white dark:bg-darkCard border rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all ${
                  isLowStock
                    ? "border-red-200/50 dark:border-red-950/40 bg-red-50/10 dark:bg-red-950/5"
                    : "border-slate-100 dark:border-darkBorder"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="relative">
                    <img
                      src={p.imageUrl || defaultProductImg}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = defaultProductImg;
                      }}
                    />
                    {!p.active && (
                      <span className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center text-[9px] text-white font-bold uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-wide mt-0.5 font-mono">
                      {p.sku}
                    </p>
                    <p className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold">
                      {p.category?.name || "Category"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Stock Metrics */}
                  <div className="text-right">
                    <span
                      className={`font-black text-xs px-2 py-0.5 rounded-md ${
                        isLowStock
                          ? "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      }`}
                    >
                      Stock: {p.currentStock || 0}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                      Price: ₹
                      {parseFloat(p.purchasePrice.toString()).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  {isOnline && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 rounded-xl transition-all"
                        title="Edit Product"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-rose-50 rounded-xl transition-all"
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {isLowStock && (
                  <div className="absolute top-1.5 right-1.5 text-red-500">
                    <AlertTriangle size={12} className="stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FILTER DRAWER BOTTOM SHEET */}
      <Drawer
        isOpen={showFiltersDrawer}
        onClose={() => setShowFiltersDrawer(false)}
        title="Filter Products"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-200"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-darkBg border border-slate-100 dark:border-darkBorder rounded-xl">
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Low Stock Threshold (≤ 5)
              </p>
              <p className="text-[10px] text-slate-400">
                Show products with critical inventory.
              </p>
            </div>
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                filterLowStock ? "bg-red-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  filterLowStock ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => setShowFiltersDrawer(false)}
            className="w-full py-3 bg-brand-500 text-white font-bold rounded-xl shadow-md text-xs"
          >
            Apply Filters
          </button>
        </div>
      </Drawer>

      {/* ADD/EDIT FORM DRAWER BOTTOM SHEET */}
      <Drawer
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        title={
          editingProduct ? "Edit Product Master" : "Add New Product Master"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">
              {formError}
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Designer Kurti"
              className="w-full px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Category *
              </label>
              <select
                required
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Purchase Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Purchase Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-xs focus:outline-none dark:text-slate-100"
              />
            </div>
          </div>

          {/* Active status checkbox */}
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="formActive"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="w-4 h-4 rounded text-brand-500 border-slate-300 focus:ring-brand-500"
            />
            <label
              htmlFor="formActive"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase select-none cursor-pointer"
            >
              Active Status
            </label>
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              Product Image (Optional)
            </label>

            <div className="flex items-center gap-3">
              {imagePreview ? (
                <div className="relative w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-darkBorder overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormImageFile(null);
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 text-[8px]"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-darkBorder hover:border-brand-500 dark:hover:border-brand-400 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/20 text-slate-400 transition-colors">
                  <ImageIcon size={20} />
                  <span className="text-[8px] font-bold uppercase mt-1">
                    Upload
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
              <div className="text-[10px] text-slate-400">
                PNG, JPG or WEBP formats. Compression is run before uploading.
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            {editingProduct ? (
              <>
                <PackageCheck size={16} />
                <span>
                  {submitting ? "Saving Changes..." : "Save Product Master"}
                </span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>{submitting ? "Adding..." : "Add Product Master"}</span>
              </>
            )}
          </button>
        </form>
      </Drawer>
    </div>
  );
};

export default Products;
