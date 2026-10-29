'use client';

import { useEffect, useState } from 'react';
import { supabase, checkConnectivity } from '@/lib/supabaseClient';
import { offlineDb } from '@/lib/offlineDb';

interface Item {
  id: string; // Assuming standard UUID primary key
  sku: string;
  name: string;
  description: string;
  cost_price: number;
  sell_price: number;
  qty_in_stock: number;
  reorder_level: number;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form states
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    description: '',
    cost_price: 0,
    sell_price: 0,
    qty_in_stock: 0,
    reorder_level: 10, // default alert marker reorder level
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setItems(data || []);
      } else {
        setItems(offlineDb.getItems() as any);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      setItems(offlineDb.getItems() as any);
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { error } = await supabase.from('items').insert([newItem]);
        if (error) throw error;
      } else {
        offlineDb.insertItem(newItem);
      }
      setIsAddModalOpen(false);
      setNewItem({ sku: '', name: '', description: '', cost_price: 0, sell_price: 0, qty_in_stock: 0, reorder_level: 10 });
      fetchItems();
    } catch (error: any) {
      alert('Error adding item: ' + error.message);
    }
  };

  const handleUpdatePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { error } = await supabase
          .from('items')
          .update({
            cost_price: editingItem.cost_price,
            sell_price: editingItem.sell_price,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        offlineDb.updateItem(editingItem.id, {
          cost_price: editingItem.cost_price,
          sell_price: editingItem.sell_price,
        });
      }
      setEditingItem(null);
      fetchItems();
    } catch (error: any) {
      alert('Error updating prices: ' + error.message);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
          <p className="text-slate-500 text-sm">Track and update your warehouse stock.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
        >
          + Add New Item
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4">Cost Price</th>
              <th className="px-6 py-4">Sell Price</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading inventory...</td></tr>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.sku}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{item.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.qty_in_stock <= 5 ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                      {item.qty_in_stock} in stock
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">₹{new Intl.NumberFormat('en-IN').format(item.cost_price)}</td>
                  <td className="px-6 py-4 text-slate-900 font-medium">₹{new Intl.NumberFormat('en-IN').format(item.sell_price)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setEditingItem(item)}
                      className="text-teal-600 hover:text-teal-700 text-sm font-semibold"
                    >
                      Quick Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add New Item</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SKU</label>
                  <input required type="text" className="w-full border p-2 rounded" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock Qty</label>
                  <input required type="number" className="w-full border p-2 rounded" value={newItem.qty_in_stock} onChange={e => setNewItem({...newItem, qty_in_stock: parseInt(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                <input required type="text" className="w-full border p-2 rounded" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea className="w-full border p-2 rounded text-sm" rows={2} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost Price (₹)</label>
                  <input required type="number" step="0.01" className="w-full border p-2 rounded" value={newItem.cost_price} onChange={e => setNewItem({...newItem, cost_price: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sell Price (₹)</label>
                  <input required type="number" step="0.01" className="w-full border p-2 rounded" value={newItem.sell_price} onChange={e => setNewItem({...newItem, sell_price: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Prices Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xs w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update Prices</h3>
            <p className="text-sm text-slate-500 mb-4">{editingItem.name}</p>
            <form onSubmit={handleUpdatePrices} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost Price (₹)</label>
                <input 
                  autoFocus
                  required 
                  type="number" 
                  step="0.01" 
                  className="w-full border p-2 rounded text-lg font-semibold" 
                  value={editingItem.cost_price} 
                  onChange={e => setEditingItem({...editingItem, cost_price: parseFloat(e.target.value)})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sell Price (₹)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  className="w-full border p-2 rounded text-lg font-semibold" 
                  value={editingItem.sell_price} 
                  onChange={e => setEditingItem({...editingItem, sell_price: parseFloat(e.target.value)})} 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingItem(null)} 
                  className="flex-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold text-sm"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}