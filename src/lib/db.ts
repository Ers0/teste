import Dexie, { Table } from 'dexie';

export interface Item {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  barcode: string | null;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
  one_time_use: boolean;
  is_tool: boolean;
  is_ppe: boolean;
  image_url: string | null;
  user_id: string;
  tags: string[] | null;
}

export interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: string | null;
  external_qr_code_data: string | null;
  user_id: string;
  reliability_score: number | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

export interface Kit {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
}

export interface KitItem {
    id: string;
    kit_id: string;
    item_id: string;
    quantity: number;
    user_id: string;
}

class LocalDatabase extends Dexie {
  items!: Table<Item, string>;
  workers!: Table<Worker, string>;
  tags!: Table<Tag, string>;
  kits!: Table<Kit, string>;
  kit_items!: Table<KitItem, string>;

  constructor() {
    super('YeesInventoryDB');
    this.version(1).stores({
      items: '&id, name, *tags',
      workers: '&id, name, company',
      tags: '&id, name',
      kits: '&id, name',
      kit_items: '&id, kit_id, item_id',
    });
  }
}

export const db = new LocalDatabase();