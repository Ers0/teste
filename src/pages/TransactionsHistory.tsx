import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { exportToCsv } from '@/utils/export';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';

interface Transaction {
  id: string;
  item_id: string;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'takeout' | 'return' | 'restock'>('all');
  const [filterItem, setFilterItem] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');

  const { data: transactions, isLoading, error } = useQuery<Transaction[], Error>({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name), company, authorized_by, given_by')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const { data: items } = useQuery<Item[], Error>({
    queryKey: ['items', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('items').select('id, name').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const { data: workers } = useQuery<Worker[], Error>({
    queryKey: ['workers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('workers').select('id, name').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(transaction => {
      const matchesSearch = searchTerm === '' ||
        transaction.items?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.workers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.authorized_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.given_by?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || transaction.type === filterType;
      const matchesItem = filterItem === 'all' || transaction.item_id === filterItem;
      const matchesWorker = filterWorker === 'all' || transaction.worker_id === filterWorker;
      return matchesSearch && matchesType && matchesItem && matchesWorker;
    });
  }, [transactions, searchTerm, filterType, filterItem, filterWorker]);

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      showError(t('no_transactions_to_export'));
      return;
    }
    const dataToExport = filteredTransactions.map(transaction => ({
      [t('item_name')]: transaction.items?.name || 'N/A',
      [t('worker_name')]: transaction.workers?.name || 'N/A',
      [t('company')]: transaction.company || 'N/A',
      [t('transaction_type')]: t(transaction.type),
      [t('quantity')]: transaction.quantity,
      [t('authorized_by')]: transaction.authorized_by || 'N/A',
      [t('given_by')]: transaction.given_by || 'N/A',
      [t('timestamp')]: new Date(transaction.timestamp).toLocaleString(),
    }));
    exportToCsv(dataToExport, 'transactions_history.csv');
    showSuccess(t('report_downloaded_successfully'));
  };

  if (isLoading) return <div>{t('loading_history')}</div>;
  if (error) return <div>{t('error_fetching_transaction_history')} {error.message}</div>;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('transactions_history_title')}</CardTitle>
          <CardDescription>{t('all_transactions_overview')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Input
              placeholder={t('search_transactions')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'takeout' | 'return' | 'restock')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filter_by_type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types')}</SelectItem>
                <SelectItem value="takeout">{t('takeout')}</SelectItem>
                <SelectItem value="return">{t('return')}</SelectItem>
                <SelectItem value="restock">{t('restock')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterItem} onValueChange={setFilterItem}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filter_by_item')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_items')}</SelectItem>
                {items?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterWorker} onValueChange={setFilterWorker}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filter_by_worker')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_workers')}</SelectItem>
                {workers?.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('item_name')}</TableHead>
                <TableHead>{t('worker_name')}</TableHead>
                <TableHead>{t('company')}</TableHead>
                <TableHead>{t('transaction_type')}</TableHead>
                <TableHead className="text-right">{t('quantity')}</TableHead>
                <TableHead>{t('authorized_by')}</TableHead>
                <TableHead>{t('given_by')}</TableHead>
                <TableHead className="text-right">{t('timestamp')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.items?.name || 'N/A'}</TableCell>
                  <TableCell>{transaction.workers?.name || 'N/A'}</TableCell>
                  <TableCell>{transaction.company || 'N/A'}</TableCell>
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
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    {t('no_transactions_found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsHistory;