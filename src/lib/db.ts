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

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
}

export interface Transaction {
  id: string;
  item_id: string;
  worker_id: string | null;
  company: string | null;
  type: 'takeout' | 'return' | 'restock';
  quantity: number;
  timestamp: string;
  user_id: string;
  authorized_by: string | null;
  given_by: string | null;
  requisition_id: string | null;
  is_broken: boolean;
}

export interface Requisition {
  id: string;
  requisition_number: string;
  user_id: string;
  authorized_by: string | null;
  given_by: string | null;
  requester_name: string | null;
  requester_company: string | null;
  application_location: string | null;
  created_at: string;
}


export interface OfflineAction {
  id?: number;
  type: 'create' | 'update' | 'delete';
  tableName: string;
  payload: any;
  timestamp: number;
}

class LocalDatabase extends Dexie {
  items!: Table<Item, string>;
  workers!: Table<Worker, string>;
  tags!: Table<Tag, string>;
  kits!: Table<Kit, string>;
  kit_items!: Table<KitItem, string>;
  profiles!: Table<Profile, string>;
  transactions!: Table<Transaction, string>;
  requisitions!: Table<Requisition, string>;
  offline_queue!: Table<OfflineAction, number>;

  constructor() {
    super('YeesInventoryDB');
    this.version(4).stores({
      items: '&id, name, *tags',
      workers: '&id, name, company',
      tags: '&id, name',
      kits: '&id, name',
      kit_items: '&id, kit_id, item_id',
      profiles: '&id',
      transactions: '&id, item_id, worker_id, requisition_id, user_id',
      requisitions: '&id, requisition_number, user_id',
      offline_queue: '++id, timestamp',
    });
  }
}

export const db = new LocalDatabase();