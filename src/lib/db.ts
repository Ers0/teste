import Dexie, { Table } from 'dexie';
import { Item, Worker, Transaction, Tag, Kit, KitItem, Requisition, FiscalNote, Profile } from '@/types';

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

  constructor() {
    super('YeesAlmoxarifadoDB');
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