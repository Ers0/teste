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
  requires_requisition: boolean;
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
  assigned_ppes: string[] | null;
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
  role: string;
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
  items?: { name: string } | null;
  workers?: { name: string } | null;
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
  status: string;
}

export interface RequisitionItem {
  id: string;
  requisition_id: string;
  item_id: string;
  quantity: number;
  user_id: string;
  created_at: string;
}

export interface FiscalNote {
  id: string;
  nfe_key: string;
  description: string | null;
  arrival_date: string | null;
  user_id: string;
  created_at: string;
  photo_url: string | null;
}