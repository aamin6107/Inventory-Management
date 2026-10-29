'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  description?: string;
}

export default function CreateInvoicePage() {
  const router = useRouter();

  // Page Data States
  const [shops, setShops] = useState<Shop[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Autocomplete Item States
  const [activeItemDropdownIdx, setActiveItemDropdownIdx] = useState<number | null>(null);
  const [focusedSuggestionIdx, setFocusedSuggestionIdx] = useState<number>(-1);
  const itemDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Form States
  const [formShopId, setFormShopId] = useState('');
  const [formTerms, setFormTerms] = useState('Due on receipt');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'sent'>('sent');
  const [formLines, setFormLines] = useState<Array<{
    item_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    searchQuery: string;
  }>>([{ item_id: '', description: '', quantity: 1, unit_price: 0, discount_pct: 0, searchQuery: '' }]);

  // Fetch initial ledger database items
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const isOnline = await checkConnectivity();
        if (isOnline) {
          const [shopsRes, itemsRes] = await Promise.all([
            supabase.from('shops').select('id, name, shop_code, outstanding_bal').order('name'),
            supabase.from('items').select('id, sku, name, sell_price, qty_in_stock').order('name')
          ]);
          setShops(shopsRes.data || []);
          setItems(itemsRes.data || []);
        } else {
          setShops(offlineDb.getShops());
          setItems(offlineDb.getItems() as any);
        }
      } catch (e) {
        console.error('Error loading data:', e);
        setShops(offlineDb.getShops());
        setItems(offlineDb.getItems() as any);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Click outside to close item autocomplete search result dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activeItemDropdownIdx !== null) {
        const ref = itemDropdownRefs.current[activeItemDropdownIdx];
        if (ref && !ref.contains(event.target as Node)) {
          setActiveItemDropdownIdx(null);
          setFocusedSuggestionIdx(-1);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeItemDropdownIdx]);

  // Sync / calculate due date whenever date or terms change
  useEffect(() => {
    const dateObj = new Date(formDate);
    if (isNaN(dateObj.getTime())) return;
    
    let daysToAdd = 0;
    if (formTerms === 'Net 15') daysToAdd = 15;
    else if (formTerms === 'Net 30') daysToAdd = 30;
    else if (formTerms === 'Net 60') daysToAdd = 60;

    dateObj.setDate(dateObj.getDate() + daysToAdd);
    setFormDueDate(dateObj.toISOString().split('T')[0]);
  }, [formDate, formTerms]);

  // Calculate totals for Form (No GST - GST is removed)
  const formTotals = () => {
    let subtotal = 0;
    formLines.forEach(line => {
      const lineTotal = line.quantity * line.unit_price * (1 - line.discount_pct / 100);
      subtotal += lineTotal;
    });
    const taxRate = 0;
    const taxAmount = 0;
    const totalAmount = parseFloat(subtotal.toFixed(2));
    return { subtotal, taxRate, taxAmount, totalAmount };
  };

  const handleAddLine = () => {
    setFormLines([...formLines, { item_id: '', description: '', quantity: 1, unit_price: 0, discount_pct: 0, searchQuery: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (formLines.length === 1) return;
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  const handleSelectAutocompleteItem = (index: number, selectedItem: Item) => {
    const newLines = [...formLines];
    newLines[index] = {
      ...newLines[index],
      item_id: selectedItem.id,
      description: selectedItem.name,
      unit_price: selectedItem.sell_price,
      quantity: 1,
      searchQuery: selectedItem.name
    };
    setFormLines(newLines);
    setActiveItemDropdownIdx(null);
    setFocusedSuggestionIdx(-1);
  };

  const handleLineValueChange = (index: number, field: string, value: string | number) => {
    const newLines = [...formLines];
    newLines[index] = {
      ...newLines[index],
      [field]: value,
    };
    setFormLines(newLines);
  };

  const activeQuery = activeItemDropdownIdx !== null ? formLines[activeItemDropdownIdx]?.searchQuery : null;

  // Memoized filter matcher to prevent typing lag
  const filteredItems = useMemo(() => {
    if (activeItemDropdownIdx === null) return [];
    const query = activeQuery || '';
    
    // Default: show top 5 stocked items when query is empty
    if (!query) {
      return items.filter(it => it.qty_in_stock > 0).slice(0, 5);
    }
    
    const q = query.toLowerCase();

    // 1. Direct contains / match check (SKU, Name, or Description)
    const directMatches = items.filter(it => 
      it.name.toLowerCase().includes(q) || 
      it.sku.toLowerCase().includes(q) ||
      (it.description && it.description.toLowerCase().includes(q))
    );
    if (directMatches.length > 0) return directMatches;

    // 2. Sequential character check (e.g. typing "tmt" matches "Tomato")
    const seqMatches = items.filter(it => {
      const text = it.name.toLowerCase();
      let queryIdx = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === q[queryIdx]) {
          queryIdx++;
        }
        if (queryIdx === q.length) return true;
      }
      return false;
    });
    if (seqMatches.length > 0) return seqMatches;

    // 3. Edit distance check for misspellings (e.g. typing "tomotato" matches "Tomato")
    const fuzzyMatches = items.filter(it => {
      const text = it.name.toLowerCase();
      if (q.length >= 3) {
        let commonChars = 0;
        const textChars = text.split('');
        q.split('').forEach(char => {
          const idx = textChars.indexOf(char);
          if (idx > -1) {
            commonChars++;
            textChars.splice(idx, 1);
          }
        });
        if (commonChars / q.length >= 0.7 && Math.abs(text.length - q.length) <= 4) {
          return true;
        }
      }
      return false;
    });
    return fuzzyMatches;
  }, [items, activeQuery, activeItemDropdownIdx]);

  // Keyboard navigation for autocomplete list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (activeItemDropdownIdx !== index || filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIdx(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIdx(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      if (focusedSuggestionIdx >= 0 && focusedSuggestionIdx < filteredItems.length) {
        e.preventDefault();
        handleSelectAutocompleteItem(index, filteredItems[focusedSuggestionIdx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveItemDropdownIdx(null);
      setFocusedSuggestionIdx(-1);
    }
  };

  // Submit invoice registration
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formShopId) {
      alert('Please choose a shop / client.');
      return;
    }
    const emptyItem = formLines.some(l => !l.item_id || l.quantity <= 0);
    if (emptyItem) {
      alert('Ensure all line rows select an item and have valid positive quantities.');
      return;
    }

    setSaving(true);
    try {
      const { subtotal, taxRate, taxAmount, totalAmount } = formTotals();
      const shopObj = shops.find(s => s.id === formShopId)!;
      const isOnline = await checkConnectivity();

      if (isOnline) {
        // Auto-generate sequential/numeric invoice number matching QuickBooks style
        const { data: invList } = await supabase.from('invoices').select('invoice_number');
        const numericInvoices = (invList || [])
          .map(inv => parseInt(inv.invoice_number.replace(/\D/g, '')))
          .filter(n => !isNaN(n));
        const nextNum = numericInvoices.length > 0 ? Math.max(...numericInvoices) + 1 : 335633;
        const invNum = String(nextNum);

        // 1. Insert Invoice
        const { data: invData, error: invError } = await supabase
          .from('invoices')
          .insert([
            {
              invoice_number: invNum,
              shop_id: formShopId,
              status: formStatus,
              invoice_date: formDate,
              due_date: formDueDate,
              subtotal,
              discount_pct: 0,
              discount_amount: 0,
              taxable_amount: subtotal,
              tax_rate: taxRate,
              tax_amount: taxAmount,
              total_amount: totalAmount,
              amount_paid: 0,
              amount_due: formStatus === 'sent' ? totalAmount : 0,
              terms: formTerms,
              notes: formNotes || null,
            }
          ])
          .select();

        if (invError) throw invError;
        const createdInvoice = invData[0] as any;

        // 2. Insert Invoice Items
        const invoiceItemsToSave = formLines.map((line, idx) => ({
          invoice_id: createdInvoice.id,
          item_id: line.item_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_pct: line.discount_pct,
          line_total: line.quantity * line.unit_price * (1 - line.discount_pct / 100),
          sort_order: idx,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemsToSave);
        if (itemsError) throw itemsError;

        // 3. Deduct stock quantities from Items table
        for (const line of formLines) {
          const itemObj = items.find(it => it.id === line.item_id)!;
          const newQty = itemObj.qty_in_stock - line.quantity;
          const { error: stockErr } = await supabase
            .from('items')
            .update({ qty_in_stock: newQty })
            .eq('id', line.item_id);
          if (stockErr) console.error('Deduct stock error:', stockErr);
        }

        // 4. Update Shop outstanding balance if status is active receivables (status === 'sent')
        if (formStatus === 'sent') {
          const newOutstanding = (shopObj.outstanding_bal || 0) + totalAmount;
          const { error: shopErr } = await supabase
            .from('shops')
            .update({ outstanding_bal: newOutstanding })
            .eq('id', formShopId);
          if (shopErr) console.error('Update shop balance error:', shopErr);
        }
      } else {
        // Offline persistence
        const numericInvoices = offlineDb.getInvoices()
          .map(inv => parseInt(inv.invoice_number.replace(/\D/g, '')))
          .filter(n => !isNaN(n));
        const nextNum = numericInvoices.length > 0 ? Math.max(...numericInvoices) + 1 : 335633;
        const invNum = String(nextNum);

        offlineDb.insertInvoice(
          {
            invoice_number: invNum,
            shop_id: formShopId,
            status: formStatus,
            invoice_date: formDate,
            due_date: formDueDate,
            subtotal,
            discount_pct: 0,
            discount_amount: 0,
            taxable_amount: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            amount_paid: 0,
            amount_due: formStatus === 'sent' ? totalAmount : 0,
            terms: formTerms,
            notes: formNotes || null,
          },
          formLines
        );

        // Deduct offline stocks
        for (const line of formLines) {
          const itemObj = items.find(it => it.id === line.item_id);
          if (itemObj) {
            const newQty = itemObj.qty_in_stock - line.quantity;
            offlineDb.updateItem(line.item_id, { qty_in_stock: newQty });
          }
        }

        // Update shop outstanding balance offline
        if (formStatus === 'sent') {
          const newOutstanding = (shopObj.outstanding_bal || 0) + totalAmount;
          offlineDb.updateShop(formShopId, { outstanding_bal: newOutstanding });
        }
      }

      router.push('/invoices');
    } catch (err: any) {
      alert('Error creating invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2ca01c]"></div>
        <span className="text-sm mt-3 font-semibold text-slate-500">Loading billing workspace...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full p-8 bg-slate-50 min-h-screen text-slate-800">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Invoice</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">QuickBooks Online Style</p>
        </div>
        <Link
          href="/invoices"
          className="text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-300 rounded-full px-4 py-2 bg-white transition shadow-sm"
        >
          ← Back to transactions
        </Link>
      </div>

      <form onSubmit={handleSubmitInvoice} className="space-y-6">
        {/* Customer selection, dates and terms */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          {/* Shop Selector */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Customer</label>
            <select
              required
              value={formShopId}
              onChange={e => setFormShopId(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg bg-white focus:ring-1 focus:ring-[#2ca01c] focus:border-[#2ca01c] outline-none text-xs font-bold text-slate-800"
            >
              <option value="">-- Choose Customer --</option>
              {shops.map(sh => (
                <option key={sh.id} value={sh.id}>
                  {sh.name} ({sh.shop_code})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invoice date</label>
            <input
              required
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg bg-white focus:ring-1 focus:ring-[#2ca01c] focus:border-[#2ca01c] outline-none text-xs font-bold text-slate-800"
            />
          </div>

          {/* Terms */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment Terms</label>
            <select
              value={formTerms}
              onChange={e => setFormTerms(e.target.value)}
              className="w-full border border-slate-300 p-2.5 rounded-lg bg-white focus:ring-1 focus:ring-[#2ca01c] focus:border-[#2ca01c] outline-none text-xs font-bold text-slate-800"
            >
              <option value="Due on receipt">Due on receipt</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>

          {/* Due Date (Calculated) */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Due date</label>
            <input
              readOnly
              type="date"
              value={formDueDate}
              className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-100 outline-none text-xs font-bold text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Product/Service details section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Product/Service details</h2>
            <button
              type="button"
              onClick={handleAddLine}
              className="bg-[#2ca01c]/10 hover:bg-[#2ca01c]/20 text-[#2ca01c] px-4 py-2 rounded-lg text-xs font-bold transition active:scale-95 shadow-sm"
            >
              + Add row
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 w-8 text-center text-[9px] uppercase">#</th>
                  <th className="px-4 py-2.5 w-[35%] text-[9px] uppercase">Product</th>
                  <th className="px-4 py-2.5 w-[30%] text-[9px] uppercase">Description</th>
                  <th className="px-4 py-2.5 w-[10%] text-center text-[9px] uppercase">Qty</th>
                  <th className="px-4 py-2.5 w-[12%] text-right text-[9px] uppercase">Rate (per Qty)</th>
                  <th className="px-4 py-2.5 w-[12%] text-right text-[9px] uppercase">Amount</th>
                  <th className="px-4 py-2.5 w-10 text-center text-[9px] uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {formLines.map((line, index) => {
                  const isDropdownOpen = activeItemDropdownIdx === index;
                  const lineTotal = line.quantity * line.unit_price * (1 - line.discount_pct / 100);
                  const selectedItemObj = items.find(it => it.id === line.item_id);
                  const isLowStock = selectedItemObj && line.quantity > selectedItemObj.qty_in_stock;

                  return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-center text-slate-400 font-bold">{index + 1}</td>
                      
                      {/* Search Autocomplete Product input */}
                      <td className="px-4 py-3 relative">
                        <div
                          ref={el => {
                            itemDropdownRefs.current[index] = el;
                          }}
                          className="w-full"
                        >
                          <input
                            required
                            type="text"
                            placeholder="Type SKU or vegetable name (e.g. Tomato or t)..."
                            value={line.searchQuery}
                            onFocus={() => {
                              setActiveItemDropdownIdx(index);
                              setFocusedSuggestionIdx(0);
                            }}
                            onKeyDown={e => handleKeyDown(e, index)}
                            onChange={e => {
                              handleLineValueChange(index, 'searchQuery', e.target.value);
                              if (line.item_id) {
                                handleLineValueChange(index, 'item_id', '');
                              }
                            }}
                            className="w-full border border-slate-300 rounded-md p-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#2ca01c] focus:outline-none"
                          />

                          {/* Floating autocomplete suggestions list */}
                          {isDropdownOpen && (
                            <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 rounded-md shadow-xl max-h-[220px] overflow-y-auto z-40 divide-y divide-slate-100">
                              {filteredItems.length > 0 ? (
                                filteredItems.map((item, sIdx) => {
                                  const isFocused = sIdx === focusedSuggestionIdx;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleSelectAutocompleteItem(index, item)}
                                      onMouseEnter={() => setFocusedSuggestionIdx(sIdx)}
                                      className={`w-full text-left p-2.5 transition flex items-center justify-between text-xs ${
                                        isFocused ? 'bg-[#2ca01c]/10 font-black text-slate-900' : 'hover:bg-[#2ca01c]/5 text-slate-700'
                                      }`}
                                    >
                                      <div>
                                        <span className="bg-slate-100 text-slate-700 font-mono px-1 rounded mr-2 text-[9px]">{item.sku}</span>
                                        <span className="font-bold">{item.name}</span>
                                      </div>
                                      <div className="font-bold flex items-center space-x-2">
                                        <span>${item.sell_price.toFixed(2)}</span>
                                        <span className={`text-[9px] px-1 rounded ${
                                          item.qty_in_stock <= 5 ? 'bg-rose-50 text-rose-600 font-extrabold' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                          {item.qty_in_stock} stock
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-3 text-slate-400 italic text-center text-xs">
                                  No items matching your search.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <input
                          required
                          type="text"
                          placeholder="Description"
                          value={line.description}
                          onChange={e => handleLineValueChange(index, 'description', e.target.value)}
                          className="w-full border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-[#2ca01c] focus:outline-none"
                        />
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3 text-center">
                        <input
                          required
                          type="number"
                          min="1"
                          placeholder="1"
                          value={line.quantity}
                          onChange={e => handleLineValueChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          className={`w-16 border rounded-md p-1.5 text-xs text-center font-bold font-mono focus:ring-1 focus:outline-none ${
                            isLowStock 
                              ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/50 text-rose-900' 
                              : 'border-slate-300 focus:ring-[#2ca01c]'
                          }`}
                        />
                        {isLowStock && (
                          <div className="text-[8px] text-rose-600 font-extrabold mt-0.5 whitespace-nowrap">
                            Max: {selectedItemObj.qty_in_stock}
                          </div>
                        )}
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3 text-right">
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.unit_price}
                          onChange={e => handleLineValueChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-20 border border-slate-300 rounded-md p-1.5 text-xs text-right font-bold font-mono focus:ring-1 focus:ring-[#2ca01c] focus:outline-none"
                        />
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(lineTotal)}
                      </td>

                      {/* Remove Line */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          disabled={formLines.length === 1}
                          className={`text-slate-300 hover:text-rose-600 transition-colors text-sm font-bold ${formLines.length === 1 ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes and Grand Totals calculation summaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* Notes and initial status setting */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Memo / Invoice Notes</label>
              <textarea
                rows={3}
                placeholder="Type billing memo to print on invoice statements..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg focus:border-[#2ca01c] focus:ring-1 focus:ring-[#2ca01c] outline-none text-xs font-bold text-slate-700 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Initial Transaction Status</label>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormStatus('sent')}
                  className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${formStatus === 'sent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                >
                  Sent & Unpaid (Active Open Invoice)
                </button>
                <button
                  type="button"
                  onClick={() => setFormStatus('draft')}
                  className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${formStatus === 'draft' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                >
                  Draft / Estimate
                </button>
              </div>
            </div>
          </div>

          {/* Grand Totals (No GST) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center space-y-4">
            <div className="flex justify-between text-sm font-medium text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono font-bold">{formatCurrency(formTotals().subtotal)}</span>
            </div>
            <div className="flex justify-between font-black text-slate-900 text-lg border-t border-dashed border-slate-200 pt-4">
              <span>Balance / Total amount due</span>
              <span className="font-mono text-[#2ca01c] text-xl">{formatCurrency(formTotals().totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-4 pt-4 border-t border-slate-200 mt-6 py-4">
          <Link
            href="/invoices"
            className="flex-1 px-4 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors border border-slate-300 rounded-full bg-white text-center shadow-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-2 px-8 py-3.5 bg-[#2ca01c] text-white rounded-full font-bold text-xs shadow-sm hover:bg-[#208312] transition-all active:scale-95 disabled:bg-emerald-400"
          >
            {saving ? 'Creating record...' : 'Save and send'}
          </button>
        </div>
      </form>
    </div>
  );
}
