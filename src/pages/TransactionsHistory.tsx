import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { ArrowLeft, Download, Filter, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { exportToCsv } from '@/utils/export';

interface Transaction {
  id: string;
  item_id: string | null;
  worker_id: string | null;
  company: string | null;
  type: 'takeout' | 'return' | 'restock';
  quantity: number;
  timestamp: string;
  items: { name: string } | null;
  workers: { name: string } | null;
  user_id: string;
  authorized_by: string | null;
  given_by: string | null;
}

interface Item {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  name: string;
}

const TransactionsHistory = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);

  const [filterType, setFilterType] = useState<'all' | 'takeout' | 'return' | 'restock'>('all');
  const [filterItem, setFilterItem] = useState<string>('all');
  const [filterWorker, setFilterWorker] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, filterType, filterItem, filterWorker, searchTerm]);

  const fetchAllData = async () => {
    if (!user) return;

    // Fetch all items and workers for filter dropdowns
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id, name')
      .eq('user_id', user.id);
    if (itemsError) {
      showError(t('error_fetching_items') + itemsError.message);
    } else {
      setAllItems(itemsData || []);
    }

    const { data: workersData, error: workersError } = await supabase
      .from('workers')
      .select('id, name')
      .eq('user_id', user.id);
    if (workersError) {
      showError(t('error_fetching_workers') + workersError.message);
    } else {
      setAllWorkers(workersData || []);
    }

    // Fetch transactions with filters
    let query = supabase
      .from('transactions')
      .select('*, items(name), workers(name), company')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (filterType !== 'all') {
      query = query.eq('type', filterType);
    }
    if (filterItem !== 'all') {
      query = query.eq('item_id', filterItem);
    }
    if (filterWorker !== 'all') {
      query = query.eq('worker_id', filterWorker);
    }
    if (searchTerm) {
        // This is a simplified search. For more complex full-text search,
        // you'd typically use Supabase's text search features or Edge Functions.
        // For now, we'll filter client-side or add more specific `ilike` clauses.
        // Given the current structure, `ilike` on joined names is not directly possible
        // without a view or a function. So, we'll fetch all and filter in memory for simplicity.
    }

    const { data, error } = await query;

    if (error) {
      showError(t('error_fetching_transaction_history') + error.message);
    } else {
      let filteredData = data as Transaction[];
      if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filteredData = filteredData.filter(transaction =>
          (transaction.items?.name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (transaction.workers?.name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (transaction.company?.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (transaction.authorized_by?.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (transaction.given_by?.toLowerCase().includes(lowerCaseSearchTerm))
        );
      }
      setTransactions(filteredData || []);
    }
  };

  const handleExportReport = () => {
    if (!transactions || transactions.length === 0) {
      showError(t('no_transactions_to_export'));
      return;
    }

    const formattedData = transactions.map(transaction => ({
      [t('item_name')]: transaction.items?.name || 'N/A',
      [t('recipient')]: transaction.workers?.name || transaction.company || 'N/A',
      [t('transaction_type')]: t(transaction.type),
      [t('quantity')]: transaction.quantity,
      [t('authorized_by')]: transaction.authorized_by || 'N/A',
      [t('given_by')]: transaction.given_by || 'N/A',
      [t('timestamp')]: new Date(transaction.timestamp).toLocaleString(),
    }));

    const filename = `all_transactions_report.csv`;
    exportToCsv(formattedData, filename);
    showSuccess(t('report_downloaded_successfully'));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('transactions_history_title')}</CardTitle>
              <CardDescription>{t('all_transactions_overview')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={(value: 'all' | 'takeout' | 'return' | 'restock') => setFilterType(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('filter_by_type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types')}</SelectItem>
                  <SelectItem value="restock">{t('restock')}</SelectItem>
                  <SelectItem value="takeout">{t('takeout')}</SelectItem>
                  <SelectItem value="return">{t('return')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterItem} onValueChange={setFilterItem}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('filter_by_item')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_items')}</SelectItem>
                  {allItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterWorker} onValueChange={setFilterWorker}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('filter_by_worker')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_workers')}</SelectItem>
                  {allWorkers.map(worker => (
                    <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={t('search_transactions')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[200px]"
              />
              <Button onClick={fetchAllData}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleExportReport} disabled={!transactions || transactions.length === 0}>
              <Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('item_name')}</TableHead>
                  <TableHead>{t('recipient')}</TableHead>
                  <TableHead>{t('transaction_type')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead>{t('authorized_by')}</TableHead>
                  <TableHead>{t('given_by')}</TableHead>
                  <TableHead className="text-right">{t('timestamp')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions && transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.items?.name || 'N/A'}</TableCell>
                      <TableCell>{transaction.workers?.name || transaction.company || 'N/A'}</TableCell>
                      <TableCell>
                        <span
                          className={`font-medium px-2 py-1 rounded-full text-xs ${
                            transaction.type === 'takeout'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                              : transaction.type === 'return'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                        >
                          {t(transaction.type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{transaction.quantity}</TableCell>
                      <TableCell>{transaction.authorized_by || 'N/A'}</TableCell>
                      <TableCell>{transaction.given_by || 'N/A'}</TableCell>
                      <TableCell className="text-right">{new Date(transaction.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      {t('no_transactions_found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsHistory;