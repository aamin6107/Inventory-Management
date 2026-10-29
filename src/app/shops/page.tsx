'use client';

import { useEffect, useState } from 'react';
import { supabase, checkConnectivity } from '@/lib/supabaseClient';
import { offlineDb } from '@/lib/offlineDb';

interface Shop {
  id: string;
  shop_code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address_line1: string;
  outstanding_bal: number;
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address_line1: '',
  });

  useEffect(() => {
    fetchShops();
  }, []);

  async function fetchShops() {
    setLoading(true);
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        const { data, error } = await supabase
          .from('shops')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setShops(data || []);
      } else {
        setShops(offlineDb.getShops());
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
      setShops(offlineDb.getShops());
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (shop?: Shop) => {
    if (shop) {
      setEditingShop(shop);
      setFormData({
        name: shop.name,
        contact_person: shop.contact_person || '',
        phone: shop.phone || '',
        email: shop.email || '',
        address_line1: shop.address_line1 || '',
      });
    } else {
      setEditingShop(null);
      setFormData({ name: '', contact_person: '', phone: '', email: '', address_line1: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        if (editingShop) {
          const { error } = await supabase
            .from('shops')
            .update(formData)
            .eq('id', editingShop.id);

          if (error) throw error;
        } else {
          // Auto-generate a clean shop code based on current registry size
          const nextCode = `SHP-${100 + shops.length + 1}`;
          
          const { error } = await supabase.from('shops').insert([
            { ...formData, shop_code: nextCode, outstanding_bal: 0 }
          ]);

          if (error) throw error;
        }
      } else {
        if (editingShop) {
          offlineDb.updateShop(editingShop.id, formData);
        } else {
          const nextCode = `SHP-${100 + shops.length + 1}`;
          offlineDb.insertShop({ ...formData, shop_code: nextCode, outstanding_bal: 0 });
        }
      }
      setIsModalOpen(false);
      fetchShops();
    } catch (err: any) {
      alert(err.message || 'Error saving shop profile');
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.shop_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Shop Directory</h2>
          <p className="text-slate-500 text-sm font-medium">Manage vegetable retail partners and credit accounts.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-md active:scale-95"
        >
          + Register New Shop
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <input
          type="text"
          placeholder="Search by shop name or code (e.g. SHP-101)..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
      </div>

      {/* Shops Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-black tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-6 py-5">Code</th>
              <th className="px-6 py-5">Shop Name</th>
              <th className="px-6 py-5">Contact Person</th>
              <th className="px-6 py-5">Phone</th>
              <th className="px-6 py-5 text-right">Outstanding Bal</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">Loading shop database...</td></tr>
            ) : filteredShops.length > 0 ? (
              filteredShops.map((shop) => (
                <tr key={shop.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500 group-hover:text-emerald-600">{shop.shop_code}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{shop.name}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">{shop.contact_person}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-mono">{shop.phone}</td>
                  <td className="px-6 py-4 text-right font-black text-rose-600">
                    {formatCurrency(shop.outstanding_bal || 0)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenModal(shop)}
                      className="bg-slate-100 hover:bg-slate-900 text-slate-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-tighter"
                    >
                      Edit Profile
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No shops matching your search were found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {editingShop ? 'Modify Shop Profile' : 'Register New Partner'}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Enterprise Registry System</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Business / Shop Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Pasir Panjang Fresh Mart"
                  className="w-full border-2 border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Contact</label>
                  <input
                    required
                    type="text"
                    placeholder="Manager Name"
                    className="w-full border-2 border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                  <input
                    required
                    type="tel"
                    placeholder="+65 8000 0000"
                    className="w-full border-2 border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="billing@shop.com"
                  className="w-full border-2 border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Physical Store Address</label>
                <textarea
                  rows={3}
                  placeholder="Street name, Block #, Unit #"
                  className="w-full border-2 border-slate-100 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 text-sm"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard Changes</button>
                <button type="submit" className="flex-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">
                  {editingShop ? 'Update Records' : 'Save & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}