'use client';

import { useState, useEffect } from 'react';

// --- Interfaces and Constants ---
interface LayoutConfig {
  logoUrl: string;
  brandColor: string;
  fontFamily: string;
  headerAlignment: 'left' | 'center' | 'right';
  compactMode: boolean;
  disclaimer: string;
}

const COLOR_OPTIONS = [
  { name: 'Emerald Green', value: 'bg-emerald-600', textClass: 'text-emerald-600', borderClass: 'border-emerald-600' },
  { name: 'Deep Slate', value: 'bg-slate-900', textClass: 'text-slate-900', borderClass: 'border-slate-900' },
  { name: 'Royal Blue', value: 'bg-blue-600', textClass: 'text-blue-600', borderClass: 'border-blue-600' },
  { name: 'Harvest Amber', value: 'bg-amber-600', textClass: 'text-amber-600', borderClass: 'border-amber-600' },
];

const FONT_OPTIONS = [
  { name: 'Clean Modern', value: 'font-sans' },
  { name: 'Classic Business', value: 'font-serif' },
  { name: 'Industrial Bill', value: 'font-mono' },
];

// --- Component Definition ---
export default function InvoiceCustomizerPage() {
  const [config, setConfig] = useState<LayoutConfig>({
    logoUrl: '',
    brandColor: 'bg-emerald-600',
    fontFamily: 'font-sans',
    headerAlignment: 'left',
    compactMode: false,
    disclaimer: 'Thank you for your patronage. All goods received in pristine order. Late payments are subject to a 2% monthly interest fee.',
  });

  const [showToast, setShowToast] = useState(false);

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('invoice_layout_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to parse saved invoice layout config from localStorage", e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('invoice_layout_config', JSON.stringify(config));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Helper to get active color details
  const getActiveColor = () => COLOR_OPTIONS.find(c => c.value === config.brandColor) || COLOR_OPTIONS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Template Designer</h1>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">QuickBooks Style Customizer</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-full font-black text-sm shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
            Save Layout Template
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* DESIGN CONTROL PANEL */}
        <section className="lg:col-span-5 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Visual Branding</h2>
              <p className="text-xs text-slate-500 font-medium">Configure your business identity for physical prints.</p>
            </div>

            {/* Logo Input */}
            <div className="space-y-2">
              <label htmlFor="logoUrl" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand Logo URL</label>
              <input
                id="logoUrl"
                type="text"
                placeholder="Paste image URL (e.g. Dropbox, Cloudinary link)"
                className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold transition-all"
                value={config.logoUrl}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
              />
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Accents Color Profile</label>
              <div className="grid grid-cols-4 gap-3">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setConfig({ ...config, brandColor: color.value })}
                    className={`h-10 rounded-lg border-2 transition-all ${config.brandColor === color.value ? 'border-slate-900 scale-105 shadow-md' : 'border-transparent'}`}
                    title={color.name}
                  >
                    <div className={`w-full h-full rounded-md ${color.value}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Font Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Typography</label>
              <div className="grid grid-cols-1 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => setConfig({ ...config, fontFamily: font.value })}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${config.fontFamily === font.value ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-50 hover:border-slate-100'}`}
                  >
                    <span className={`text-sm font-bold ${font.value}`}>{font.name}</span>
                    {config.fontFamily === font.value && <span className="text-emerald-500">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment Toggles */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Header Alignment</label>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => setConfig({ ...config, headerAlignment: align })}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${config.headerAlignment === align ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Mode Checkbox */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <h5 className="text-xs font-black text-slate-900">Compact Spacing Layout</h5>
                <p className="text-[10px] text-slate-500 font-medium italic">Optimized for high-volume orders.</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 accent-emerald-600 rounded"
                checked={config.compactMode}
                onChange={(e) => setConfig({ ...config, compactMode: e.target.checked })}
              />
            </div>

            {/* Disclaimer Textarea */}
            <div className="space-y-2">
              <label htmlFor="disclaimer" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Disclaimer / Terms</label>
              <textarea
                id="disclaimer"
                rows={3}
                className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-emerald-500 outline-none text-xs font-bold transition-all text-slate-600"
                value={config.disclaimer}
                onChange={(e) => setConfig({ ...config, disclaimer: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* LIVE INTERACTIVE PRINT PREVIEW */}
        <section className="lg:col-span-7">
          <div className="sticky top-24">
            <div className="mb-4 flex items-center justify-center space-x-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Rendering Mockup</span>
            </div>

            {/* Mockup Container */}
            <div className={`bg-white shadow-2xl w-full aspect-[1/1.414] max-w-[600px] mx-auto p-12 overflow-hidden flex flex-col ${config.fontFamily} border border-slate-200 transition-all duration-300`}>
              
              {/* Header Rendering */}
              <div className={`flex flex-col mb-10 ${config.headerAlignment === 'center' ? 'items-center text-center' : config.headerAlignment === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo" className="h-12 mb-4 object-contain" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-white font-black italic text-xl ${getActiveColor().value}`}>Q</div>
                )}
                <h1 className={`text-2xl font-black italic tracking-tighter ${getActiveColor().textClass}`}>HQ VEGETABLES</h1>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Wholesale Distribution Center</p>
                <div className="text-[8px] text-slate-400 mt-4 leading-tight">
                  BLOCK 14, PASIR PANJANG WHOLESALE CENTER<br />#01-242, Singapore 110014
                </div>
              </div>

              <div className={`h-1 w-full mb-8 ${getActiveColor().value}`} />

              <div className="flex justify-between items-start mb-10">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-1/2">
                  <div className="text-[6px] font-black text-slate-400 uppercase mb-1">Bill To:</div>
                  <div className="text-[10px] font-black">Pasir Panjang Fresh Market</div>
                  <div className="text-[6px] text-emerald-600 font-bold">CODE: SHP-101</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-200 uppercase tracking-widest -mt-4 mb-2 italic text-2xl">Invoice</div>
                  <div className="text-[8px] font-bold"><span className="text-slate-300">NO:</span> INV-2024001</div>
                  <div className="text-[8px] font-bold"><span className="text-slate-300">DATE:</span> 24/05/2024</div>
                </div>
              </div>

              {/* Mockup Table */}
              <table className="w-full text-left border-collapse mb-8">
                <thead>
                  <tr className={`border-b-2 border-slate-900 text-[8px] font-black uppercase tracking-widest ${getActiveColor().textClass}`}>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center w-12">Qty</th>
                    <th className="py-2 text-right w-16">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { d: '🥦 Premium Tomato (Grade A)', q: 50, a: '$250.00' },
                    { d: '🧅 Red Onions (Bulking)', q: 100, a: '$120.00' },
                    { d: '🥔 Russet Potato (Highlands)', q: 20, a: '$80.00' }
                  ].map((row, i) => (
                    <tr key={i} className="text-[8px] font-bold text-slate-800">
                      <td className={config.compactMode ? 'py-1' : 'py-3'}>{row.d}</td>
                      <td className={`text-center font-mono ${config.compactMode ? 'py-1' : 'py-3'}`}>{row.q}</td>
                      <td className={`text-right font-mono ${config.compactMode ? 'py-1' : 'py-3'}`}>{row.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-auto flex justify-between items-end border-t border-dashed border-slate-200 pt-6">
                <div className="text-[8px] text-slate-400 font-medium italic max-w-[70%]">
                  {config.disclaimer}
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-bold text-slate-600">SUBTOTAL: <span className="text-slate-900">$450.00</span></div>
                  <div className="text-[8px] font-bold text-slate-600">GST (9%): <span className="text-slate-900">$40.50</span></div>
                  <div className="text-[12px] font-black mt-2">TOTAL: <span className={`text-slate-900 ${getActiveColor().textClass}`}>$490.50</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showToast && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4">
          Layout saved successfully!
        </div>
      )}
    </div>
  );
}
