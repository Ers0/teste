import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Star } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { exportToCsv } from '@/utils/export';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Worker, Transaction } from '@/types';

interface PopulatedTransaction extends Transaction {
  items: { name: string } | null;
  workers: { name: string } | null;
}

const WorkerReport = () => {
  const { t } = useTranslation();
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const workerDetails = useLiveQuery(() => workerId ? db.workers.get(workerId) : undefined, [workerId]);

  const transactions = useLiveQuery(async () => {
    if (!workerId) return [];
    const txs = await db.transactions.where('worker_id').equals(workerId).reverse().sortBy('timestamp');
    return Promise.all(txs.map(async (tx) => {
      const item = await db.items.get(tx.item_id);
      const worker = tx.worker_id ? await db.workers.get(tx.worker_id) : null;
      return {
        ...tx,
        items: item ? { name: item.name } : null,
        workers: worker ? { name: worker.name } : null,
      };
    }));
  }, [workerId]);

  const isLoading = workerDetails === undefined || transactions === undefined;

  const handleExportReport = () => {
    if (!transactions || transactions.length === 0) {
      showError(t('no_transactions_to_export'));
      return;
    }

    const formattedData = transactions.map(transaction => ({
      [t('item_name')]: transaction.items?.name || 'N/A',
      [t('worker_name')]: transaction.workers?.name || 'N/A',
      [t('transaction_type')]: t(transaction.type),
      [t('quantity')]: transaction.quantity,
      [t('authorized_by')]: transaction.authorized_by || 'N/A',
      [t('given_by')]: transaction.given_by || 'N/A',
      [t('timestamp')]: new Date(transaction.timestamp).toLocaleString(),
    }));

    const filename = `${workerDetails?.name || 'worker'}_transaction_report.csv`;
    exportToCsv(formattedData, filename);
    showSuccess(t('report_downloaded_successfully'));
  };

  const getScoreVariant = (score: number | null): 'default' | 'secondary' | 'destructive' => {
    const currentScore = score ?? 100;
    if (currentScore >= 80) return 'default';
    if (currentScore >= 50) return 'secondary';
    return 'destructive';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_report')}</p>
      </div>
    );
  }

  if (!workerDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">{t('worker_not_found')}</CardTitle>
            <CardDescription>{t('worker_details_could_not_be_loaded')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)}>{t('go_back')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('transaction_history_for', { workerName: workerDetails.name })}</CardTitle>
              <CardDescription>{t('overview_of_all_transactions_by_worker')}</CardDescription>
              <div className="mt-2">
                <Badge variant={getScoreVariant(workerDetails.reliability_score)}>
                  <Star className="mr-2 h-4 w-4" />
                  {t('reliability_score')}: {workerDetails.reliability_score ?? 100}
                </Badge>
              </div>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={handleExportReport} disabled={!transactions || transactions.length === 0}>
              <Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('item_name')}</TableHead>
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
                      <TableCell>
                        <span
                          className={`font-medium px-2 py-1 rounded-full text-xs ${
                            transaction.type === 'takeout'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
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
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      {t('no_transactions_found_for_this_worker')}
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

export default WorkerReport;