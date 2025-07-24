import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ArrowLeft } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { exportToCsv } from '@/utils/export';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Transaction, Item, Worker } from '@/types';

interface PopulatedTransaction extends Transaction {
  items: { name: string } | null;
  workers: { name: string } | null;
}

const TransactionsHistory = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'takeout' | 'return' | 'restock'>('all');
  const [filterItem, setFilterItem] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');
  const navigate = useNavigate();

  const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray(), []);
  const items = useLiveQuery(() => db.items.toArray(), []);
  const workers = useLiveQuery(() => db.workers.toArray(), []);

  const populatedTransactions = useMemo<PopulatedTransaction[]>(() => {
    if (!transactions || !items || !workers) return [];
    const itemsMap = new Map(items.map(i => [i.id, i]));
    const workersMap = new Map(workers.map(w => [w.id, w]));

    return transactions.map(tx => ({
      ...tx,
      items: tx.item_id ? { name: itemsMap.get(tx.item_id)?.name || 'N/A' } : null,
      workers: tx.worker_id ? { name: workersMap.get(tx.worker_id)?.name || 'N/A' } : null,
    }));
  }, [transactions, items, workers]);

  const filteredTransactions = useMemo(() => {
    if (!populatedTransactions) return [];
    return populatedTransactions.filter(transaction => {
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
  }, [populatedTransactions, searchTerm, filterType, filterItem, filterWorker]);

  const brokenToolsTransactions = useMemo(() => {
    if (!populatedTransactions) return [];
    return populatedTransactions.filter(t => t.is_broken);
  }, [populatedTransactions]);

  const handleExport = (dataToExport: PopulatedTransaction[], filename: string) => {
    if (!dataToExport || dataToExport.length === 0) {
      showError(t('no_transactions_to_export'));
      return;
    }
    const formattedData = dataToExport.map(transaction => ({
      [t('item_name')]: transaction.items?.name || 'N/A',
      [t('worker_name')]: transaction.workers?.name || 'N/A',
      [t('company')]: transaction.company || 'N/A',
      [t('transaction_type')]: t(transaction.type),
      [t('quantity')]: transaction.quantity,
      [t('authorized_by')]: transaction.authorized_by || 'N/A',
      [t('given_by')]: transaction.given_by || 'N/A',
      [t('timestamp')]: new Date(transaction.timestamp).toLocaleString(),
      [t('broken')]: transaction.is_broken ? t('yes') : t('no'),
    }));
    exportToCsv(formattedData, filename);
    showSuccess(t('report_downloaded_successfully'));
  };

  if (transactions === undefined || items === undefined || workers === undefined) return <div>{t('loading_history')}</div>;

  const renderTable = (data: PopulatedTransaction[]) => (
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
        {data.length > 0 ? data.map((transaction) => (
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
  );

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle>{t('transactions_history_title')}</CardTitle>
              <CardDescription>{t('all_transactions_overview')}</CardDescription>
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all_transactions">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all_transactions">{t('all_transactions')}</TabsTrigger>
              <TabsTrigger value="broken_tools">{t('broken_tools_report')}</TabsTrigger>
            </TabsList>
            <TabsContent value="all_transactions">
              <div className="flex flex-wrap items-center gap-4 my-4">
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
                <Button onClick={() => handleExport(filteredTransactions, 'transactions_history.csv')}><Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}</Button>
              </div>
              {renderTable(filteredTransactions)}
            </TabsContent>
            <TabsContent value="broken_tools">
              <div className="flex justify-end my-4">
                <Button onClick={() => handleExport(brokenToolsTransactions, 'broken_tools_report.csv')}><Download className="mr-2 h-4 w-4" /> {t('export_report')}</Button>
              </div>
              {renderTable(brokenToolsTransactions)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsHistory;