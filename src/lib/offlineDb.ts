// Local Storage offline database backup for HQ Warehouse
import { createClient } from '@supabase/supabase-js';

export interface Shop {
  id: string;
  shop_code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address_line1: string;
  outstanding_bal: number;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string;
  cost_price: number;
  sell_price: number;
  qty_in_stock: number;
  reorder_level: number;
}

export interface Invoice {
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

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  sort_order: number;
  items?: { name: string; sku: string };
}

// Initial seed data
const SEED_SHOPS: Shop[] = [
  {
    id: 's-1',
    shop_code: 'SHP-101',
    name: 'Pasir Panjang Fresh Market',
    contact_person: 'Tan Ah Kow',
    phone: '+65 9123 4567',
    email: 'contact@pasirpanjangfresh.com',
    address_line1: 'Blk 1 Pasir Panjang Wholesale Centre #01-11',
    outstanding_bal: 490.50
  },
  {
    id: 's-2',
    shop_code: 'SHP-102',
    name: 'Seng Kang Groceries',
    contact_person: 'Lee Min Ho',
    phone: '+65 9876 5432',
    email: 'billing@sengkanggrocer.sg',
    address_line1: 'Blk 211 Seng Kang East Way #02-12',
    outstanding_bal: 120.00
  },
  {
    id: 's-3',
    shop_code: 'SHP-103',
    name: 'Tampines Vegetable Hub',
    contact_person: 'Fatimah Ali',
    phone: '+65 8123 4567',
    email: 'accounts@tampinesvegehub.sg',
    address_line1: 'Blk 504 Tampines Central 1 #01-44',
    outstanding_bal: 0.00
  }
];

const SEED_ITEMS: Item[] = [
  { id: 'i-1', sku: 'VEG-TOM-001', name: '🥦 Premium Tomato (Grade A)', description: 'Fresh greenhouse tomatoes from Cameron Highlands', cost_price: 3.50, sell_price: 5.00, qty_in_stock: 120, reorder_level: 15 },
  { id: 'i-2', sku: 'VEG-ONN-002', name: '🧅 Red Onions (Bulking)', description: 'Medium sized red onions from India, highly pungent', cost_price: 0.80, sell_price: 1.20, qty_in_stock: 450, reorder_level: 50 },
  { id: 'i-3', sku: 'VEG-POT-003', name: '🥔 Russet Potato (Highlands)', description: 'Premium Russet Potatoes, perfect for baking and frying', cost_price: 2.80, sell_price: 4.00, qty_in_stock: 3, reorder_level: 10 },
  { id: 'i-4', sku: 'VEG-SPI-004', name: '🥬 Organic Spinach', description: 'Freshly harvested organic spinach leaves, local origin', cost_price: 1.50, sell_price: 2.50, qty_in_stock: 4, reorder_level: 8 },
  { id: 'i-5', sku: 'VEG-BRO-005', name: '🥦 Fresh Broccoli', description: 'Crunchy broccoli florets imported from Australia', cost_price: 4.00, sell_price: 6.50, qty_in_stock: 45, reorder_level: 12 },
  { id: 'i-6', sku: 'VEG-GAR-006', name: '🧄 Garlic Bulbs', description: 'White garlic bulbs in nets, high quality storage pack', cost_price: 2.00, sell_price: 3.20, qty_in_stock: 80, reorder_level: 20 }
];

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoice_number: '335633',
    shop_id: 's-1',
    status: 'sent',
    invoice_date: '2026-06-24',
    due_date: '2026-06-24',
    subtotal: 450.00,
    discount_pct: 0,
    discount_amount: 0,
    taxable_amount: 450.00,
    tax_rate: 9,
    tax_amount: 40.50,
    total_amount: 490.50,
    amount_paid: 0,
    amount_due: 490.50,
    terms: 'Due on receipt',
    notes: 'Please double-check invoice items before signing. Standard delivery.',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-2',
    invoice_number: '335634',
    shop_id: 's-2',
    status: 'overdue',
    invoice_date: '2026-06-10',
    due_date: '2026-06-25',
    subtotal: 110.09,
    discount_pct: 0,
    discount_amount: 0,
    taxable_amount: 110.09,
    tax_rate: 9,
    tax_amount: 9.91,
    total_amount: 120.00,
    amount_paid: 0,
    amount_due: 120.00,
    terms: 'Net 15',
    notes: 'Terms net 15.',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'inv-3',
    invoice_number: '335635',
    shop_id: 's-3',
    status: 'paid',
    invoice_date: '2026-06-28',
    due_date: '2026-06-28',
    subtotal: 300.00,
    discount_pct: 0,
    discount_amount: 0,
    taxable_amount: 300.00,
    tax_rate: 9,
    tax_amount: 27.00,
    total_amount: 327.00,
    amount_paid: 327.00,
    amount_due: 0,
    terms: 'Due on receipt',
    notes: 'Paid via PayNow.',
    created_at: new Date().toISOString()
  }
];

const SEED_INVOICE_ITEMS: InvoiceItem[] = [
  { id: 'ii-1', invoice_id: 'inv-1', item_id: 'i-1', description: '🥦 Premium Tomato (Grade A)', quantity: 50, unit_price: 5.00, discount_pct: 0, line_total: 250.00, sort_order: 0 },
  { id: 'ii-2', invoice_id: 'inv-1', item_id: 'i-2', description: '🧅 Red Onions (Bulking)', quantity: 100, unit_price: 1.20, discount_pct: 0, line_total: 120.00, sort_order: 1 },
  { id: 'ii-3', invoice_id: 'inv-1', item_id: 'i-3', description: '🥔 Russet Potato (Highlands)', quantity: 20, unit_price: 4.00, discount_pct: 0, line_total: 80.00, sort_order: 2 },
  { id: 'ii-4', invoice_id: 'inv-2', item_id: 'i-2', description: '🧅 Red Onions (Bulking)', quantity: 100, unit_price: 1.20, discount_pct: 0, line_total: 120.00, sort_order: 0 },
  { id: 'ii-5', invoice_id: 'inv-3', item_id: 'i-5', description: '🥦 Fresh Broccoli', quantity: 50, unit_price: 6.54, discount_pct: 0, line_total: 327.00, sort_order: 0 }
];

// LocalStorage helpers to query and save state
function getLocalStorageData<T>(key: string, initialSeed: T[]): T[] {
  if (typeof window === 'undefined') return initialSeed;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(initialSeed));
    return initialSeed;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`Failed to parse localStorage key ${key}`, e);
    return initialSeed;
  }
}

function setLocalStorageData<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Database APIs
export const offlineDb = {
  // Shops
  getShops(): Shop[] {
    return getLocalStorageData<Shop>('offline_shops', SEED_SHOPS);
  },
  saveShops(shops: Shop[]): void {
    setLocalStorageData<Shop>('offline_shops', shops);
  },
  insertShop(shop: Omit<Shop, 'id'>): Shop {
    const shops = this.getShops();
    const newShop = { ...shop, id: `s-${Date.now()}` };
    shops.push(newShop);
    this.saveShops(shops);
    return newShop;
  },
  updateShop(id: string, updates: Partial<Omit<Shop, 'id'>>): Shop | null {
    const shops = this.getShops();
    const idx = shops.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const updated = { ...shops[idx], ...updates };
    shops[idx] = updated;
    this.saveShops(shops);
    return updated;
  },

  // Items (Inventory)
  getItems(): Item[] {
    return getLocalStorageData<Item>('offline_items', SEED_ITEMS);
  },
  saveItems(items: Item[]): void {
    setLocalStorageData<Item>('offline_items', items);
  },
  insertItem(item: Omit<Item, 'id'>): Item {
    const items = this.getItems();
    const newItem = { ...item, id: `i-${Date.now()}` };
    items.push(newItem);
    this.saveItems(items);
    return newItem;
  },
  updateItem(id: string, updates: Partial<Omit<Item, 'id'>>): Item | null {
    const items = this.getItems();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    const updated = { ...items[idx], ...updates };
    items[idx] = updated;
    this.saveItems(items);
    return updated;
  },

  // Invoices (with mock join lookup)
  getInvoices(): Invoice[] {
    const invoices = getLocalStorageData<Invoice>('offline_invoices', SEED_INVOICES);
    const shops = this.getShops();
    
    // Perform simulated join for `.select('*, shops(name, shop_code)')`
    return invoices.map(inv => {
      const shopObj = shops.find(s => s.id === inv.shop_id);
      return {
        ...inv,
        shops: shopObj ? { name: shopObj.name, shop_code: shopObj.shop_code } : { name: 'Unknown Shop', shop_code: 'N/A' }
      };
    });
  },
  saveInvoices(invoices: Invoice[]): void {
    // Strip nested joins before saving
    const cleanInvoices = invoices.map(({ shops, ...rest }) => rest);
    setLocalStorageData<any>('offline_invoices', cleanInvoices);
  },
  
  // Invoice Items
  getInvoiceItems(invoiceId?: string): InvoiceItem[] {
    const itemsList = getLocalStorageData<InvoiceItem>('offline_invoice_items', SEED_INVOICE_ITEMS);
    const inventoryItems = this.getItems();

    // Perform simulated join for `.select('*, items(name, sku)')`
    const joined = itemsList.map(row => {
      const invItemObj = inventoryItems.find(item => item.id === row.item_id);
      return {
        ...row,
        items: invItemObj ? { name: invItemObj.name, sku: invItemObj.sku } : undefined
      };
    });

    if (invoiceId) {
      return joined.filter(row => row.invoice_id === invoiceId);
    }
    return joined;
  },
  saveInvoiceItems(items: InvoiceItem[]): void {
    const cleanItems = items.map(({ items: nestedItems, ...rest }) => rest);
    setLocalStorageData<any>('offline_invoice_items', cleanItems);
  },

  // Transaction for creating Invoice and line items
  insertInvoice(
    invoice: Omit<Invoice, 'id' | 'created_at'>,
    lines: Array<{ item_id: string; description: string; quantity: number; unit_price: number; discount_pct: number }>
  ): Invoice {
    const invoices = getLocalStorageData<Invoice>('offline_invoices', SEED_INVOICES);
    const invoiceItems = getLocalStorageData<InvoiceItem>('offline_invoice_items', SEED_INVOICE_ITEMS);

    const newInvoiceId = `inv-${Date.now()}`;
    const newInvoice: Invoice = {
      ...invoice,
      id: newInvoiceId,
      created_at: new Date().toISOString()
    };
    
    invoices.push(newInvoice);
    this.saveInvoices(invoices);

    const newLines = lines.map((line, idx) => ({
      id: `ii-${Date.now()}-${idx}`,
      invoice_id: newInvoiceId,
      item_id: line.item_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_pct: line.discount_pct,
      line_total: line.quantity * line.unit_price * (1 - line.discount_pct / 100),
      sort_order: idx
    }));

    const updatedInvoiceItems = [...invoiceItems, ...newLines];
    this.saveInvoiceItems(updatedInvoiceItems);

    return newInvoice;
  },

  // Adjust dashboard views for offline display
  getDashboardMetrics() {
    const invoices = this.getInvoices();
    let total_revenue = 0;
    let total_collected = 0;
    let total_outstanding = 0;

    invoices.forEach(inv => {
      if (inv.status !== 'void' && inv.status !== 'draft') {
        total_revenue += inv.total_amount;
        total_collected += inv.amount_paid;
        total_outstanding += inv.amount_due;
      }
    });

    return {
      total_revenue,
      total_collected,
      total_outstanding
    };
  },

  getOverdueInvoices() {
    const invoices = this.getInvoices();
    const now = new Date();
    return invoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        return (inv.status === 'overdue' || (inv.status === 'sent' && dueDate < now)) && inv.amount_due > 0;
      })
      .map(inv => ({
        id: inv.id,
        shop_name: inv.shops?.name || 'Unknown Client',
        due_date: inv.due_date,
        total_amount: inv.amount_due
      }));
  },

  getLowStockItems() {
    const items = this.getItems();
    return items
      .filter(it => it.qty_in_stock <= it.reorder_level)
      .map(it => ({
        id: it.id,
        name: it.name,
        qty_in_stock: it.qty_in_stock,
        reorder_level: it.reorder_level
      }));
  }
};
