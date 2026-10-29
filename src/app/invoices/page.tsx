'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, checkConnectivity } from '@/lib/supabaseClient';
import { offlineDb } from '@/lib/offlineDb';

// --- Interfaces ---
interface Shop {
  id: string;
  name: string;
  shop_code: string;
  outstanding_bal: number;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  sell_price: number;
  qty_in_stock: number;
}

interface InvoiceItem {
  id?: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  items?: { name: string; sku: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  shop_id: string;
  status: 'draft' | 'sent' | 'overdue' | 'void' | 'paid';
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  taxable_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  terms: string;
  notes: string | null;
  created_at: string;
  shops?: { name: string; shop_code: string };
}

interface LayoutConfig {
  logoUrl: string;
  brandColor: string;
  fontFamily: string;
  headerAlignment: 'left' | 'center' | 'right';
  compactMode: boolean;
  disclaimer: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'bg-emerald-600': { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600' },
  'bg-slate-900': { bg: 'bg-slate-900', text: 'text-slate-900', border: 'border-slate-900' },
  'bg-blue-600': { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600' },
  'bg-amber-600': { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-600' },
};

export default function InvoicesPage() {
  // Page Data States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Invoices');
  const [dateFilter, setDateFilter] = useState('Last 3 months');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'overdue' | 'void' | 'paid'>('all');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [activeDropdownRow, setActiveDropdownRow] = useState<string | null>(null);

  // Modal / Drawer States
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItemsList, setInvoiceItemsList] = useState<InvoiceItem[]>([]);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Template customizer settings loaded from localStorage
  const [printConfig, setPrintConfig] = useState<LayoutConfig>({
    logoUrl: '',
    brandColor: 'bg-emerald-600',
    fontFamily: 'font-sans',
    headerAlignment: 'left',
    compactMode: false,
    disclaimer: 'Thank you for your patronage.',
  });

  // Fetch initial ledger database items
  useEffect(() => {
    fetchInvoices();
  }, []);

  // Load custom layout template print styles from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('invoice_layout_config');
    if (savedConfig) {
      try {
        setPrintConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to parse saved invoice layout config", e);
      }
    }
  }, [isViewOpen]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { data, error } = await supabase
          .from('invoices')
          .select('*, shops(name, shop_code)')
          .order('invoice_number', { ascending: false });

        if (error) throw error;
        setInvoices(data || []);
      } else {
        setInvoices(offlineDb.getInvoices() as any);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices(offlineDb.getInvoices() as any);
    } finally {
      setLoading(false);
    }
  }

  // View Details and Print Action
  const handleOpenView = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { data, error } = await supabase
          .from('invoice_items')
          .select('*, items(name, sku)')
          .eq('invoice_id', invoice.id)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setInvoiceItemsList(data || []);
      } else {
        setInvoiceItemsList(offlineDb.getInvoiceItems(invoice.id) as any);
      }
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      setInvoiceItemsList(offlineDb.getInvoiceItems(invoice.id) as any);
    }
    setIsViewOpen(true);
  };

  // Mark invoice as paid
  const handleMarkAsPaid = async (invoice: Invoice) => {
    const confirmed = confirm(`Are you sure you want to mark Invoice ${invoice.invoice_number} as PAID?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        // 1. Update invoice status
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            amount_paid: invoice.total_amount,
            amount_due: 0,
          })
          .eq('id', invoice.id);

        if (invErr) throw invErr;

        // 2. Adjust shop outstanding balance
        if (invoice.status === 'sent' || invoice.status === 'overdue') {
          const { data: shopData } = await supabase.from('shops').select('outstanding_bal').eq('id', invoice.shop_id).single();
          if (shopData) {
            const newOutstanding = Math.max(0, (shopData.outstanding_bal || 0) - invoice.amount_due);
            await supabase
              .from('shops')
              .update({ outstanding_bal: newOutstanding })
              .eq('id', invoice.shop_id);
          }
        }
      } else {
        // Offline update
        const invoicesList = offlineDb.getInvoices();
        const idx = invoicesList.findIndex(inv => inv.id === invoice.id);
        if (idx !== -1) {
          invoicesList[idx] = {
            ...invoicesList[idx],
            status: 'paid',
            amount_paid: invoice.total_amount,
            amount_due: 0
          };
          offlineDb.saveInvoices(invoicesList);
        }

        if (invoice.status === 'sent' || invoice.status === 'overdue') {
          const offlineShops = offlineDb.getShops();
          const shopObj = offlineShops.find(s => s.id === invoice.shop_id);
          if (shopObj) {
            const newOutstanding = Math.max(0, (shopObj.outstanding_bal || 0) - invoice.amount_due);
            offlineDb.updateShop(invoice.shop_id, { outstanding_bal: newOutstanding });
          }
        }
      }

      setIsViewOpen(false);
      setActiveDropdownRow(null);
      await fetchInvoices();
    } catch (err: any) {
      alert('Error updating invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Void Invoice logic
  const handleVoidInvoice = async (invoice: Invoice) => {
    const confirmed = confirm(`Voiding Invoice ${invoice.invoice_number} will restore item stocks and subtract its totals from customer credit accounts. Proceed?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        // 1. Update status to void
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            status: 'void',
            amount_due: 0,
          })
          .eq('id', invoice.id);

        if (invErr) throw invErr;

        // 2. Adjust shop outstanding balance if it was unpaid
        if (invoice.status === 'sent' || invoice.status === 'overdue') {
          const { data: shopData } = await supabase.from('shops').select('outstanding_bal').eq('id', invoice.shop_id).single();
          if (shopData) {
            const newOutstanding = Math.max(0, (shopData.outstanding_bal || 0) - invoice.amount_due);
            await supabase
              .from('shops')
              .update({ outstanding_bal: newOutstanding })
              .eq('id', invoice.shop_id);
          }
        }

        // 3. Query all lines to restore stock
        const { data: lines } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);

        if (lines) {
          for (const line of lines) {
            const { data: currentItems } = await supabase
              .from('items')
              .select('qty_in_stock')
              .eq('id', line.item_id)
              .limit(1);

            if (currentItems && currentItems.length > 0) {
              const returnedStock = currentItems[0].qty_in_stock + line.quantity;
              await supabase
                .from('items')
                .update({ qty_in_stock: returnedStock })
                .eq('id', line.item_id);
            }
          }
        }
      } else {
        // Offline update
        const invoicesList = offlineDb.getInvoices();
        const idx = invoicesList.findIndex(inv => inv.id === invoice.id);
        if (idx !== -1) {
          invoicesList[idx] = {
            ...invoicesList[idx],
            status: 'void',
            amount_due: 0
          };
          offlineDb.saveInvoices(invoicesList);
        }

        if (invoice.status === 'sent' || invoice.status === 'overdue') {
          const offlineShops = offlineDb.getShops();
          const shopObj = offlineShops.find(s => s.id === invoice.shop_id);
          if (shopObj) {
            const newOutstanding = Math.max(0, (shopObj.outstanding_bal || 0) - invoice.amount_due);
            offlineDb.updateShop(invoice.shop_id, { outstanding_bal: newOutstanding });
          }
        }

        const lines = offlineDb.getInvoiceItems(invoice.id);
        const offlineItems = offlineDb.getItems();
        for (const line of lines) {
          const itemObj = offlineItems.find(it => it.id === line.item_id);
          if (itemObj) {
            const returnedStock = itemObj.qty_in_stock + line.quantity;
            offlineDb.updateItem(line.item_id, { qty_in_stock: returnedStock });
          }
        }
      }

      setIsViewOpen(false);
      setActiveDropdownRow(null);
      await fetchInvoices();
    } catch (err: any) {
      alert('Error voiding invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger browser print dialog for printable element
  const handlePrint = () => {
    window.print();
  };

  const activePrintColor = COLOR_MAP[printConfig.brandColor] || { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600' };

  // Calculate dynamic dashboard summary values based on REAL database query rows
  const computeMetrics = () => {
    let estimatesCount = 0;
    let estimatesSum = 0;
    let unbilledCount = 0;
    let unbilledSum = 0;
    let overdueCount = 0;
    let overdueSum = 0;
    let openCount = 0;
    let openSum = 0;
    let paidCount = 0;
    let paidSum = 0;

    invoices.forEach(inv => {
      const amount = inv.total_amount;
      const balance = inv.amount_due;
      if (inv.status === 'draft') {
        estimatesCount++;
        estimatesSum += amount;
        unbilledCount++;
        unbilledSum += amount;
      } else if (inv.status === 'overdue') {
        overdueCount++;
        overdueSum += balance;
      } else if (inv.status === 'sent') {
        openCount++;
        openSum += balance;
      } else if (inv.status === 'paid') {
        paidCount++;
        paidSum += amount;
      }
    });

    return {
      estimatesCount,
      estimatesSum,
      unbilledCount,
      unbilledSum,
      overdueCount,
      overdueSum,
      openCount,
      openSum,
      paidCount,
      paidSum
    };
  };

  const metrics = computeMetrics();

  // Multi-select bulk handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(filteredInvoices.map(inv => inv.id));
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const handleSelectInvoice = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    } else {
      setSelectedInvoiceIds(selectedInvoiceIds.filter(x => x !== id));
    }
  };

  // Filtering invoices logic
  const filteredInvoices = invoices.filter(inv => {
    const shopName = inv.shops?.name || '';
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shopName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filter by metrics tab / status filter
    if (statusFilter === 'all') return true;
    if (statusFilter === 'draft') return inv.status === 'draft';
    return inv.status === statusFilter;
  });

  // Calculate table visible footer totals
  const tableTotals = () => {
    let balanceTotal = 0;
    let amountTotal = 0;
    filteredInvoices.forEach(inv => {
      balanceTotal += inv.amount_due;
      amountTotal += inv.total_amount;
    });
    return { balanceTotal, amountTotal };
  };

  const totals = tableTotals();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const getStatusLabelAndStyle = (inv: Invoice) => {
    if (inv.status === 'paid') {
      return { text: 'Paid', class: 'text-emerald-700 font-bold' };
    }
    if (inv.status === 'void') {
      return { text: 'Void', class: 'text-slate-400 italic' };
    }
    if (inv.status === 'draft') {
      return { text: 'Draft', class: 'text-slate-600 font-medium' };
    }
    // For sent / overdue, display payment deadline
    const diffTime = new Date(inv.due_date).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (inv.status === 'overdue' || diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, class: 'text-rose-600 font-bold' };
    }
    return { text: `Due in ${diffDays} days`, class: 'text-slate-700' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-6 print:p-0 print:m-0 min-h-screen bg-slate-50 print:bg-white text-slate-800">
      {/* Sales Transactions Header */}
      <div className="flex justify-between items-center print:hidden pb-1">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-slate-900">Sales transactions</h1>
        </div>
        <div className="relative inline-block">
          <Link
            href="/invoices/create"
            className="bg-[#2ca01c] hover:bg-[#208312] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
          >
            <span>New transaction</span>
            <span className="text-[10px] ml-1">▼</span>
          </Link>
        </div>
      </div>

      {/* CONTINUOUS COLOR SUMMARY BAR (QUICKBOOKS STYLE) */}
      <div className="grid grid-cols-5 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden divide-x divide-slate-200 print:hidden select-none">
        {/* ESTIMATES - BLUE */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
          className={`text-left p-4 pb-2 transition-all hover:bg-slate-50 flex flex-col justify-between ${statusFilter === 'draft' ? 'bg-sky-50/40 ring-2 ring-sky-500 ring-inset' : ''}`}
        >
          <div>
            <p className="text-slate-900 text-[20px] font-black">{formatCurrency(metrics.estimatesSum)}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{metrics.estimatesCount} estimates</p>
          </div>
          <div className="h-1.5 w-full bg-sky-500 rounded-full mt-4" />
        </button>

        {/* UNBILLED INCOME - PURPLE */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
          className={`text-left p-4 pb-2 transition-all hover:bg-slate-50 flex flex-col justify-between ${statusFilter === 'draft' ? 'bg-purple-50/40 ring-2 ring-purple-500 ring-inset' : ''}`}
        >
          <div>
            <p className="text-slate-900 text-[20px] font-black">{formatCurrency(metrics.unbilledSum)}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unbilled income</p>
          </div>
          <div className="h-1.5 w-full bg-purple-600 rounded-full mt-4" />
        </button>

        {/* OVERDUE - ORANGE */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          className={`text-left p-4 pb-2 transition-all hover:bg-slate-50 flex flex-col justify-between ${statusFilter === 'overdue' ? 'bg-orange-50/40 ring-2 ring-orange-500 ring-inset' : ''}`}
        >
          <div>
            <p className="text-rose-600 text-[20px] font-black">{formatCurrency(metrics.overdueSum)}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{metrics.overdueCount} overdue invoices</p>
          </div>
          <div className="h-1.5 w-full bg-orange-500 rounded-full mt-4" />
        </button>

        {/* OPEN INVOICES - LIGHT ORANGE / GRAY */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
          className={`text-left p-4 pb-2 transition-all hover:bg-slate-50 flex flex-col justify-between ${statusFilter === 'sent' ? 'bg-amber-50/40 ring-2 ring-amber-500 ring-inset' : ''}`}
        >
          <div>
            <p className="text-slate-900 text-[20px] font-black">{formatCurrency(metrics.openSum)}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{metrics.openCount} open invoices and credits</p>
          </div>
          <div className="h-1.5 w-full bg-amber-500 rounded-full mt-4" />
        </button>

        {/* RECENTLY PAID - GREEN */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
          className={`text-left p-4 pb-2 transition-all hover:bg-slate-50 flex flex-col justify-between ${statusFilter === 'paid' ? 'bg-emerald-50/40 ring-2 ring-emerald-500 ring-inset' : ''}`}
        >
          <div>
            <p className="text-emerald-600 text-[20px] font-black">{formatCurrency(metrics.paidSum)}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{metrics.paidCount} recently paid</p>
          </div>
          <div className="h-1.5 w-full bg-[#2ca01c] rounded-full mt-4" />
        </button>
      </div>

      {/* FILTER CONTROLS BAR (QUICKBOOKS ONLINE REPLICA) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm print:hidden">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Batch Actions */}
          <button
            disabled={selectedInvoiceIds.length === 0}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-1"
          >
            <span>Batch actions</span>
            <span className="text-[8px] text-slate-500">▼</span>
          </button>

          {/* Type Select */}
          <div className="flex items-center space-x-1 border border-slate-300 rounded-md bg-white px-2 py-1">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mr-1">Type</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="Invoices">Invoices</option>
              <option value="All transactions">All transactions</option>
            </select>
          </div>

          {/* Date Select */}
          <div className="flex items-center space-x-1 border border-slate-300 rounded-md bg-white px-2 py-1">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mr-1">Date</span>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="Last 3 months">Last 3 months</option>
              <option value="Last 12 months">Last 12 months</option>
              <option value="All Dates">All Dates</option>
            </select>
          </div>

          {/* All Statuses */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 outline-none cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Open (Sent)</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>

        {/* Customer Search Bar */}
        <div className="relative group max-w-xs w-full">
          <input
            type="text"
            placeholder="Search customer, number, or memo..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent text-xs font-medium text-slate-700 shadow-inner"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
        </div>
      </div>

      {/* QUICKBOOKS ONLINE STYLE DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 tracking-wider">
            <tr>
              <th className="px-4 py-3.5 w-8 print:hidden">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#2ca01c] focus:ring-[#2ca01c]"
                  checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                  onChange={e => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">Date</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">Type</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">No. ▼</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">Customer</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">Memo</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Balance</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Amount</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px]">Status</th>
              <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px] text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-slate-400 font-medium">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2ca01c]"></div>
                    <span className="text-xs">Fetching transactions from QuickBooks Ledger...</span>
                  </div>
                </td>
              </tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map(inv => {
                const dateParts = inv.invoice_date.split('-');
                // Format date as DD/MM/YY
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0].substring(2)}` : inv.invoice_date;
                const statusDetails = getStatusLabelAndStyle(inv);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3 print:hidden">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#2ca01c] focus:ring-[#2ca01c]"
                        checked={selectedInvoiceIds.includes(inv.id)}
                        onChange={e => handleSelectInvoice(inv.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{formattedDate}</td>
                    <td className="px-4 py-3 text-slate-500 font-bold">Invoice</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px] truncate" title={inv.shops?.name}>
                      {inv.shops?.name || 'Unknown Client'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={inv.notes || ''}>
                      {inv.notes || '-'}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-800 text-right font-mono">{formatCurrency(inv.amount_due)}</td>
                    <td className="px-4 py-3 font-extrabold text-slate-900 text-right font-mono">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={statusDetails.class}>
                        {statusDetails.text}
                      </span>
                    </td>
                    {/* Action Dropdown Column (Hidden in print) */}
                    <td className="px-4 py-2 text-right relative print:hidden whitespace-nowrap">
                      <div className="inline-flex items-center rounded-md divide-x divide-slate-200">
                        {/* Primary Button */}
                        {inv.status === 'sent' || inv.status === 'overdue' ? (
                          <button
                            onClick={() => handleMarkAsPaid(inv)}
                            className="text-sky-700 hover:text-sky-900 font-bold text-xs py-1.5 px-2 hover:bg-slate-100/50 rounded-l-md transition-colors"
                          >
                            Receive payment
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenView(inv)}
                            className="text-sky-700 hover:text-sky-900 font-bold text-xs py-1.5 px-2 hover:bg-slate-100/50 rounded-l-md transition-colors"
                          >
                            View/Edit
                          </button>
                        )}
                        {/* Secondary Dropdown toggle caret */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownRow(activeDropdownRow === inv.id ? null : inv.id);
                            }}
                            className="py-2.5 px-1.5 hover:bg-slate-100/50 rounded-r-md text-sky-700 transition-colors"
                          >
                            <span className="text-[8px]">▼</span>
                          </button>
                          {/* Floating Row Dropdown options */}
                          {activeDropdownRow === inv.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-md shadow-lg z-20 divide-y divide-slate-100 py-1 text-left">
                              <button
                                onClick={() => {
                                  setActiveDropdownRow(null);
                                  handleOpenView(inv);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                              >
                                View / Print
                              </button>
                              {inv.status !== 'paid' && inv.status !== 'void' && (
                                <button
                                  onClick={() => handleMarkAsPaid(inv)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                                >
                                  Receive payment
                                </button>
                              )}
                              {inv.status !== 'void' && (
                                <button
                                  onClick={() => handleVoidInvoice(inv)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-rose-600 font-bold text-xs"
                                >
                                  Void Invoice
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-slate-400 italic font-medium">
                  No invoice records match the selected options.
                </td>
              </tr>
            )}
          </tbody>
          {/* Table totals footer */}
          {filteredInvoices.length > 0 && (
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-slate-800 font-black">
              <tr>
                <td className="px-4 py-3 print:hidden"></td>
                <td colSpan={5} className="px-4 py-3 font-black text-sm text-slate-700">Total</td>
                <td className="px-4 py-3 text-right font-mono font-black text-slate-900">{formatCurrency(totals.balanceTotal)}</td>
                <td className="px-4 py-3 text-right font-mono font-black text-slate-900">{formatCurrency(totals.amountTotal)}</td>
                <td></td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination component */}
      {!loading && filteredInvoices.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs font-bold text-slate-500 print:hidden select-none">
          <div>
            <span>Showing {filteredInvoices.length} transactions</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="hover:text-slate-900 transition disabled:opacity-40" disabled>First</button>
            <button className="hover:text-slate-900 transition disabled:opacity-40" disabled>Previous</button>
            <span className="text-slate-900 font-black">1-{filteredInvoices.length} of {filteredInvoices.length}</span>
            <button className="hover:text-slate-900 transition disabled:opacity-40" disabled>Next</button>
            <button className="hover:text-slate-900 transition disabled:opacity-40" disabled>Last</button>
          </div>
        </div>
      )}



      {/* VIEW & PRINT DETAILED INVOICE MODAL */}
      {isViewOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200 print:relative print:p-0 print:bg-white print:backdrop-blur-none print:shadow-none print:z-0">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 overflow-hidden animate-in zoom-in duration-200 flex flex-col print:shadow-none print:p-0 print:rounded-none print:bg-white print:max-w-none print:w-full border border-slate-200 print:border-none">
            {/* Action Bar (Hidden when printing) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-6 border-b border-slate-200 gap-4 print:hidden">
              <div>
                <h3 className="text-md font-bold text-slate-900">Ledger Statement: {selectedInvoice.invoice_number}</h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">QuickBooks Interactive Print Mockup</p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'void' && (
                  <button
                    onClick={() => handleMarkAsPaid(selectedInvoice)}
                    className="bg-[#2ca01c] hover:bg-[#208312] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                  >
                    Receive payment
                  </button>
                )}
                {selectedInvoice.status !== 'void' && (
                  <button
                    onClick={() => handleVoidInvoice(selectedInvoice)}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                  >
                    Void Invoice
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 flex items-center space-x-1"
                >
                  <span>🖨️</span> <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => setIsViewOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>

            {/* PRINT PREVIEW CORE (Uses settings loaded from invoice customizer config) */}
            <div className={`flex-1 border border-slate-200 p-12 bg-white flex flex-col print:border-none print:p-0 ${printConfig.fontFamily} transition-all duration-300 relative`}>
              {/* Header rendering based on layout template settings */}
              <div className={`flex flex-col mb-8 ${printConfig.headerAlignment === 'center' ? 'items-center text-center' : printConfig.headerAlignment === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
                {printConfig.logoUrl ? (
                  <img src={printConfig.logoUrl} alt="Logo" className="h-12 mb-4 object-contain max-w-[200px]" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-white font-black italic text-xl ${activePrintColor.bg}`}>Q</div>
                )}
                <h1 className={`text-2xl font-black italic tracking-tighter ${activePrintColor.text}`}>HQ VEGETABLES</h1>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Wholesale Distribution Center</p>
                <div className="text-[8px] text-slate-400 mt-2 leading-tight">
                  BLOCK 14, PASIR PANJANG WHOLESALE CENTER<br />#01-242, Singapore 110014
                </div>
              </div>

              {/* Brand Accent Bar */}
              <div className={`h-1 w-full mb-8 ${activePrintColor.bg}`} />

              {/* Client and Invoice Metadata details */}
              <div className="flex justify-between items-start mb-8 text-[9px]">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-1/2 print:bg-white print:border-slate-200">
                  <div className="text-[7px] font-black text-slate-400 uppercase mb-1">Bill To:</div>
                  <div className="text-[11px] font-black text-slate-900">{selectedInvoice.shops?.name || 'Unknown Shop'}</div>
                  <div className="text-[7px] text-[#2ca01c] font-bold mt-0.5">CODE: {selectedInvoice.shops?.shop_code || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-black text-slate-200 uppercase tracking-widest -mt-4 mb-2 italic text-3xl print:text-slate-400">Invoice</div>
                  <div className="font-bold"><span className="text-slate-400">NO:</span> {selectedInvoice.invoice_number}</div>
                  <div className="font-bold"><span className="text-slate-400">DATE:</span> {new Date(selectedInvoice.invoice_date).toLocaleDateString()}</div>
                  <div className="font-bold"><span className="text-slate-400">DUE DATE:</span> {new Date(selectedInvoice.due_date).toLocaleDateString()}</div>
                  <div className="font-bold"><span className="text-slate-400">TERMS:</span> {selectedInvoice.terms}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse mb-8 text-[9px]">
                <thead>
                  <tr className={`border-b-2 border-slate-950 font-black uppercase tracking-widest ${activePrintColor.text}`}>
                    <th className="py-2">Product</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center w-16">Qty</th>
                    <th className="py-2 text-right w-20">Rate (per Qty)</th>
                    <th className="py-2 text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceItemsList.map((row, i) => (
                    <tr key={i} className="font-bold text-slate-800">
                      <td className={printConfig.compactMode ? 'py-1' : 'py-3'}>{row.items?.name || row.description}</td>
                      <td className={printConfig.compactMode ? 'py-1' : 'py-3'}>{row.description}</td>
                      <td className={`text-center font-mono ${printConfig.compactMode ? 'py-1' : 'py-3'}`}>{row.quantity}</td>
                      <td className={`text-right font-mono ${printConfig.compactMode ? 'py-1' : 'py-3'}`}>{formatCurrency(row.unit_price)}</td>
                      <td className={`text-right font-mono ${printConfig.compactMode ? 'py-1' : 'py-3'}`}>{formatCurrency(row.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes and Grand Totals Summary */}
              <div className="mt-auto flex justify-between items-end border-t border-dashed border-slate-200 pt-6 text-[9px]">
                <div className="text-slate-500 font-medium italic max-w-[60%] space-y-2">
                  {selectedInvoice.notes && (
                    <div>
                      <span className="text-[7px] font-black uppercase tracking-wider text-slate-400 block not-italic">Notes</span>
                      <p className="text-slate-700 not-italic text-[8px]">{selectedInvoice.notes}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[7px] font-black uppercase tracking-wider text-slate-400 block not-italic">Terms & Disclaimers</span>
                    <p className="max-w-[320px] leading-snug">{printConfig.disclaimer}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-bold text-slate-500">SUBTOTAL: <span className="text-slate-900 font-mono">{formatCurrency(selectedInvoice.subtotal)}</span></div>
                  <div className="text-[13px] font-black mt-2">TOTAL: <span className={`font-mono ${activePrintColor.text}`}>{formatCurrency(selectedInvoice.total_amount)}</span></div>
                  
                  {selectedInvoice.status === 'paid' ? (
                    <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded inline-block mt-2 tracking-widest uppercase border border-emerald-200">Fully Paid</div>
                  ) : selectedInvoice.status === 'void' ? (
                    <div className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded inline-block mt-2 tracking-widest uppercase border border-rose-200">Void Statement</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}