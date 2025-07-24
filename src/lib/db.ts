import Dexie, { Table } from 'dexie';
import { Item, Worker, Transaction, Tag, Kit, KitItem, Requisition, FiscalNote, Profile } from '@/types';

export interface Outbox {
  id?: number;
  timestamp: number;
  type: 'create' | 'update' | 'delete';
  table: string;
  payload: any;
}

export class LocalDatabase extends Dexie {
  items!: Table<Item>;
  workers!: Table<Worker>;
  transactions!: Table<Transaction>;
  tags!: Table<Tag>;
  kits!: Table<Kit>;
  kit_items!: Table<KitItem>;
  requisitions!: Table<Requisition>;
  fiscal_notes!: Table<FiscalNote>;
  profiles!: Table<Profile>;
  outbox!: Table<Outbox>;

  constructor() {
    super('YeesAlmoxarifadoDB');
    this.version(3).stores({
      items: 'id, name, barcode, *tags',
      workers: 'id, name, company, qr_code_data, external_qr_code_data',
      transactions: 'id, item_id, worker_id, type, timestamp, requisition_id',
      tags: 'id, name',
      kits: 'id, name',
      kit_items: 'id, kit_id, item_id',
      requisitions: 'id, requisition_number, created_at',
      fiscal_notes: 'id, nfe_key, created_at',
      profiles: 'id',
      outbox: '++id, timestamp',
    });
    this.version(2).stores({
      items: 'id, name, barcode, *tags',
      workers: 'id, name, company, qr_code_data, external_qr_code_data',
      transactions: 'id, item_id, worker_id, type, timestamp, requisition_id',
      tags: 'id, name',
      kits: 'id, name',
      kit_items: 'id, kit_id, item_id',
      requisitions: 'id, requisition_number',
      fiscal_notes: 'id, nfe_key',
      profiles: 'id',
      outbox: '++id, timestamp',
    });
    this.version(1).stores({
      items: 'id, name, barcode, *tags',
      workers: 'id, name, company, qr_code_data, external_qr_code_data',
      transactions: 'id, item_id, worker_id, type, timestamp, requisition_id',
      tags: 'id, name',
      kits: 'id, name',
      kit_items: 'id, kit_id, item_id',
      requisitions: 'id, requisition_number',
      fiscal_notes: 'id, nfe_key',
      profiles: 'id',
    });
  }
}

export const db = new LocalDatabase();