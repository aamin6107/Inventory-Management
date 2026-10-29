'use client';

import { useEffect, useState } from 'react';
import { supabase, checkConnectivity } from '@/lib/supabaseClient';
import { offlineDb } from '@/lib/offlineDb';

interface MonthlyRevenue {
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
}

interface OverdueInvoice {
  id: string;
  shop_name: string;
  due_date: string;
  total_amount: number;
}

interface LowStockItem {
  id: string;
  name: string;
  qty_in_stock: number; // Fixed name matching SQL view
  reorder_level: number;
}

export default function DashboardPage() {
  const [revenue, setRevenue] = useState<MonthlyRevenue | null>(null);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const isOnline = await checkConnectivity();
        if (isOnline) {
          const [revRes, overdueRes, stockRes] = await Promise.all([
            supabase.from('monthly_revenue').select('*').limit(1).maybeSingle(),
            supabase.from('overdue_invoices').select('*').order('due_date', { ascending: true }),
            supabase.from('low_stock_items').select('*'),
          ]);

          if (revRes.data) setRevenue(revRes.data);
          if (overdueRes.data) setOverdueInvoices(overdueRes.data as any);
          if (stockRes.data) setLowStockItems(stockRes.data as any);
        } else {
          setRevenue(offlineDb.getDashboardMetrics());
          setOverdueInvoices(offlineDb.getOverdueInvoices() as any);
          setLowStockItems(offlineDb.getLowStockItems() as any);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setRevenue(offlineDb.getDashboardMetrics());
        setOverdueInvoices(offlineDb.getOverdueInvoices() as any);
        setLowStockItems(offlineDb.getLowStockItems() as any);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full p-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Operational Overview</h2>
        <p className="text-slate-500">Real-time metrics from your warehouse ledger and invoices.</p>
      </div>

      {/* Metric Cards Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gross Revenue</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(revenue?.total_revenue || 0)}</p>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-semibold">
            <span className="bg-emerald-50 px-2 py-0.5 rounded">All Managed Billings</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">{formatCurrency(revenue?.total_collected || 0)}</p>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-semibold">
            <span className="bg-emerald-50 px-2 py-0.5 rounded">Settled Accounts</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Outstanding Balance</p>
          <p className="text-3xl font-black text-rose-600 mt-2">{formatCurrency(revenue?.total_outstanding || 0)}</p>
          <div className="mt-4 flex items-center text-xs text-rose-600 font-semibold">
            <span className="bg-rose-50 px-2 py-0.5 rounded">Receivables Pending</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overdue Invoices Table Component */}
        <div className="bg-white rounded-xl shadow border border-slate-100 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Overdue Invoices</h3>
            <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2.5 py-0.5 rounded-full">{overdueInvoices.length} Accounts Pending</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b">
                <tr>
                  <th className="px-6 py-3">Shop Name</th>
                  <th className="px-6 py-3">Due Deadline</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {overdueInvoices.length > 0 ? (
                  overdueInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{inv.shop_name}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right text-rose-600 font-bold">{formatCurrency(inv.total_amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic">No overdue client statements found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts Component */}
        <div className="bg-white rounded-xl shadow border border-slate-100 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Inventory Supply Alerts</h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{lowStockItems.length} Needs Restock</span>
          </div>
          <div className="p-6 space-y-3 overflow-y-auto max-h-[350px]">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-amber-50/40 rounded-xl border border-amber-100">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                    <p className="text-xs text-slate-500">Warehouse Stock: <span className="font-extrabold text-amber-700">{item.qty_in_stock}</span> / Alert Marker: {item.reorder_level}</p>
                  </div>
                  <div className="px-2.5 py-1 bg-white border border-amber-200 shadow-sm rounded-lg text-[10px] font-bold text-amber-700 uppercase tracking-wider">Low Stock</div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 italic">All vegetable units sufficiently stocked</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}