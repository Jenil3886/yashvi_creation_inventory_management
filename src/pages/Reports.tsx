import React, { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  AlertTriangle,
  FolderOpen,
  PieChart,
  UserCheck,
  TrendingUp,
} from "lucide-react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import useOfflineStore from "../store/useOfflineStore";
import apiClient from "../services/apiClient";
import { IDBHelper } from "../utils/idbHelper";

interface ReportData {
  meta: {
    startDate: string;
    endDate: string;
    rangeName: string;
  };
  totals: {
    totalAmount: number;
    totalQuantity: number;
  };
  invoiceWiseSummary: any[];
  productWiseSummary: any[];
  categoryWiseSummary: any[];
  supplierWiseSummary: any[];
  lowStockProductsSummary: any[];
}

export const Reports: React.FC = () => {
  const { isOnline } = useOfflineStore();
  const [range, setRange] = useState<"daily" | "weekly" | "monthly" | "yearly">(
    "monthly",
  );
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);

  // Tab views inside reports
  const [activeTab, setActiveTab] = useState<
    "invoices" | "products" | "categories" | "suppliers"
  >("invoices");

  const loadReport = async () => {
    setLoading(true);
    if (isOnline) {
      try {
        const res = await apiClient.get(`/reports/analytics?range=${range}`);
        const data = res.data.data;
        setReport(data);

        // Cache in IDB
        await IDBHelper.put("settings", {
          key: `cached_report_${range}`,
          value: JSON.stringify(data),
        });
      } catch (err) {
        console.error(
          "Failed fetching analytics report, loading cached data:",
          err,
        );
        await loadFromLocal();
      } finally {
        setLoading(false);
      }
    } else {
      await loadFromLocal();
      setLoading(false);
    }
  };

  const loadFromLocal = async () => {
    try {
      const cachedReportRaw = await IDBHelper.get(
        "settings",
        `cached_report_${range}`,
      );
      if (cachedReportRaw) {
        setReport(JSON.parse(cachedReportRaw.value));
      } else {
        // Fallback: Calculate basics from cached purchase history
        const cachedHistoryRaw = await IDBHelper.get(
          "settings",
          "cached_history",
        );
        if (cachedHistoryRaw) {
          const invoicesList = JSON.parse(cachedHistoryRaw.value);
          // Standard mock structure matching ReportData
          setReport({
            meta: {
              startDate: new Date().toISOString(),
              endDate: new Date().toISOString(),
              rangeName: range,
            },
            totals: {
              totalAmount: invoicesList.reduce(
                (sum: number, i: any) => sum + i.totalAmount,
                0,
              ),
              totalQuantity: invoicesList.reduce(
                (sum: number, i: any) => sum + i.totalQuantity,
                0,
              ),
            },
            invoiceWiseSummary: invoicesList.map((i: any) => ({
              invoiceNumber: i.invoiceNumber,
              purchaseDate: i.purchaseDate,
              supplierName: i.supplier?.name,
              totalQuantity: i.totalQuantity,
              totalAmount: i.totalAmount,
            })),
            productWiseSummary: [],
            categoryWiseSummary: [],
            supplierWiseSummary: [],
            lowStockProductsSummary: [],
          });
        } else {
          setReport(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadReport();
  }, [range, isOnline]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // EXPORT EXCEL ACTION
  const exportToExcel = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // 1. Overall Summary Sheet
    const summaryData = [
      { Metric: "Report Preset", Value: report.meta.rangeName.toUpperCase() },
      {
        Metric: "Start Date",
        Value: new Date(report.meta.startDate).toLocaleDateString(),
      },
      {
        Metric: "End Date",
        Value: new Date(report.meta.endDate).toLocaleDateString(),
      },
      {
        Metric: "Total Expenditure",
        Value: `INR ${report.totals.totalAmount}`,
      },
      { Metric: "Total Items Purchased", Value: report.totals.totalQuantity },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // 2. Invoice Wise Sheet
    if (report.invoiceWiseSummary.length > 0) {
      const wsInvoices = XLSX.utils.json_to_sheet(
        report.invoiceWiseSummary.map((inv) => ({
          "Invoice Number": inv.invoiceNumber,
          Date: new Date(inv.purchaseDate).toLocaleDateString(),
          Supplier: inv.supplierName,
          Quantity: inv.totalQuantity,
          "Total Amount (INR)": inv.totalAmount,
          Remarks: inv.remarks || "",
        })),
      );
      XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoices");
    }

    // 3. Product Wise Sheet
    if (report.productWiseSummary.length > 0) {
      const wsProducts = XLSX.utils.json_to_sheet(
        report.productWiseSummary.map((p) => ({
          "Product Name": p.productName,
          SKU: p.sku,
          Category: p.categoryName,
          "Quantity Purchased": p.totalQuantity,
          "Total Expense (INR)": p.totalAmount,
        })),
      );
      XLSX.utils.book_append_sheet(wb, wsProducts, "Products");
    }

    // Save Workbook
    XLSX.writeFile(wb, `YC_Purchase_Report_${range}_${Date.now()}.xlsx`);
  };

  // EXPORT CSV ACTION
  const exportToCSV = () => {
    if (!report || report.invoiceWiseSummary.length === 0) return;

    // Build raw CSV string
    const headers = [
      "Invoice Number",
      "Date",
      "Supplier",
      "Quantity",
      "Amount (INR)",
      "Remarks",
    ];
    const rows = report.invoiceWiseSummary.map((inv) => [
      inv.invoiceNumber,
      new Date(inv.purchaseDate).toLocaleDateString(),
      `"${inv.supplierName}"`,
      inv.totalQuantity,
      inv.totalAmount,
      `"${inv.remarks || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `YC_Invoice_Report_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT PDF ACTION
  const exportToPDF = () => {
    if (!report) return;

    const doc = new jsPDF();

    // Title & Header details
    doc.setFontSize(18);
    doc.text("Yashvi Creation - Purchase Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Timeframe: ${report.meta.rangeName.toUpperCase()}`, 14, 21);
    doc.text(
      `Period: ${new Date(report.meta.startDate).toLocaleDateString()} to ${new Date(
        report.meta.endDate,
      ).toLocaleDateString()}`,
      14,
      26,
    );

    // Summary numbers box
    doc.setFillColor(240, 246, 255);
    doc.rect(14, 32, 182, 18, "F");
    doc.setFont("Helvetica", "bold");
    doc.text(
      `Total Spend: INR ${parseFloat(report.totals.totalAmount.toString()).toLocaleString("en-IN")}`,
      18,
      43,
    );
    doc.text(`Total Quantity: ${report.totals.totalQuantity} items`, 110, 43);

    // Map rows for invoices table
    const invoiceRows = report.invoiceWiseSummary.map((inv) => [
      inv.invoiceNumber,
      new Date(inv.purchaseDate).toLocaleDateString(),
      inv.supplierName,
      inv.totalQuantity,
      `INR ${inv.totalAmount.toLocaleString("en-IN")}`,
    ]);

    // Render table using autotable plugin
    (doc as any).autoTable({
      startY: 56,
      head: [
        ["Invoice No", "Purchase Date", "Supplier", "Quantity", "Total Amount"],
      ],
      body: invoiceRows,
      theme: "grid",
      headStyles: { fillColor: [26, 110, 255] },
    });

    doc.save(`YC_Purchase_Report_${range}_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Offline Status */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold">
          <AlertTriangle size={15} />
          <span>Offline. Export utilizes local database caches.</span>
        </div>
      )}

      {/* Interval Select Banner */}
      <div className="bg-white dark:bg-darkCard p-3.5 border border-slate-100 dark:border-darkBorder rounded-2xl flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Preset Window
        </span>
        <div className="flex gap-1.5">
          {(["daily", "weekly", "monthly", "yearly"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                range === r
                  ? "bg-brand-500 text-white shadow-md"
                  : "bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!report ? (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-xs">
            No purchase transactions logged in this range.
          </p>
        </div>
      ) : (
        <>
          {/* Expenditure KPI Stats */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Aggregate Spend
              </span>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                ₹
                {parseFloat(
                  report.totals.totalAmount.toString(),
                ).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Purchased Units
              </span>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                {report.totals.totalQuantity} pcs
              </p>
            </div>
          </div>

          {/* Export utilities */}
          <div className="p-4 bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Export Utilities
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={exportToPDF}
                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 border border-slate-100 dark:border-darkBorder text-[10px] font-bold text-slate-600 dark:text-slate-300"
              >
                <Download size={16} className="text-red-500 mb-1" />
                <span>PDF Document</span>
              </button>
              <button
                onClick={exportToExcel}
                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 border border-slate-100 dark:border-darkBorder text-[10px] font-bold text-slate-600 dark:text-slate-300"
              >
                <FileSpreadsheet size={16} className="text-emerald-500 mb-1" />
                <span>Excel Spreadsheet</span>
              </button>
              <button
                onClick={exportToCSV}
                className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 border border-slate-100 dark:border-darkBorder text-[10px] font-bold text-slate-600 dark:text-slate-300"
              >
                <Download size={16} className="text-brand-500 mb-1" />
                <span>CSV Sheet</span>
              </button>
            </div>
          </div>

          {/* Breakdown Tabs */}
          <div className="space-y-3">
            {/* Nav Headers */}
            <div className="flex border-b border-slate-200 dark:border-darkBorder text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {(
                ["invoices", "products", "categories", "suppliers"] as const
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 pb-2 border-b-2 text-center uppercase tracking-wide transition-all ${
                    activeTab === tab
                      ? "border-brand-500 text-brand-500 dark:text-brand-400 dark:border-brand-400"
                      : "border-transparent hover:text-slate-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab contents */}
            <div className="bg-white dark:bg-darkCard border border-slate-100 dark:border-darkBorder rounded-2xl divide-y divide-slate-100 dark:divide-darkBorder overflow-hidden max-h-80 overflow-y-auto">
              {activeTab === "invoices" &&
                (report.invoiceWiseSummary.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    Empty list
                  </p>
                ) : (
                  report.invoiceWiseSummary.map((inv, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between p-3.5 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          #{inv.invoiceNumber}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {inv.supplierName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-700 dark:text-slate-300">
                          ₹{inv.totalAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {inv.totalQuantity} items
                        </p>
                      </div>
                    </div>
                  ))
                ))}

              {activeTab === "products" &&
                (report.productWiseSummary.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No product detail records cached.
                  </p>
                ) : (
                  report.productWiseSummary.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between p-3.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={p.imageUrl || "/assets/placeholder-product.png"}
                          alt={p.productName}
                          className="w-8 h-8 rounded object-cover bg-slate-100"
                        />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {p.productName}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            {p.sku}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-700 dark:text-slate-300">
                          ₹{p.totalAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {p.totalQuantity} pcs
                        </p>
                      </div>
                    </div>
                  ))
                ))}

              {activeTab === "categories" &&
                (report.categoryWiseSummary.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No category statistics found.
                  </p>
                ) : (
                  report.categoryWiseSummary.map((cat, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between p-3.5 text-xs items-center"
                    >
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <PieChart size={16} />
                        <span className="font-bold">{cat.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-700 dark:text-slate-300">
                          ₹{cat.totalAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {cat.totalQuantity} pcs
                        </p>
                      </div>
                    </div>
                  ))
                ))}

              {activeTab === "suppliers" &&
                (report.supplierWiseSummary.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No supplier statistics found.
                  </p>
                ) : (
                  report.supplierWiseSummary.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between p-3.5 text-xs items-center"
                    >
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <UserCheck size={16} />
                        <span className="font-bold">{s.supplierName}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-700 dark:text-slate-300">
                          ₹{s.totalAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {s.totalQuantity} pcs in {s.invoiceCount} inv
                        </p>
                      </div>
                    </div>
                  ))
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
