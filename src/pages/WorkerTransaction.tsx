import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { showSuccess, showError } from '@/utils/toast';
import { QrCode, Barcode, ArrowLeft, Package, Users, History as HistoryIcon, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/integrations/supabase/auth'; // Import useAuth
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components

interface Worker {
  id: string;
  name: string;
  company: string | null;
  qr_code_data: string | null;
  user_id: string; // Added user_id
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  one_time_use: boolean; // Added one_time_use to Item interface
  user_id: string; // Added user_id
}

interface Transaction {
  id: string;
  item_id: string;
  worker_id: string;
  type: 'takeout' | 'return';
  quantity: number;
  timestamp: string;
  items: { name: string };
  workers: { name: string };
  user_id: string; // Added user_id
}

const WorkerTransaction = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { user } = useAuth(); // Get the current user
  const [workerQrCodeInput, setWorkerQrCodeInput] = useState('');
  const [scannedWorker, setScannedWorker] = useState<Worker | null>(null);
  const [itemBarcodeInput, setItemBarcodeInput] = useState('');
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [quantityToChange, setQuantityToChange] = useState(1);
  const [transactionType, setTransactionType] = useState<'takeout' | 'return'>('takeout');
  const [activeTab, setActiveTab] = useState('transaction-form'); // State for active tab
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch transaction history
  const { data: transactionsHistory, isLoading: isHistoryLoading, error: historyError } = useQuery<Transaction[], Error>({
    queryKey: ['transactions', user?.id], // Include user.id in query key
    queryFn: async () => {
      if (!user) return []; // Return empty if no user
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name)')
        .eq('user_id', user.id) // Filter by user_id
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    enabled: !!user, // Only run query if user is logged in
    staleTime: 1000 * 10,
  });

  // Fetch outstanding takeouts (takeouts older than 24 hours)
  const { data: outstandingTakeouts, isLoading: isOutstandingLoading, error: outstandingError } = useQuery<Transaction[], Error>({
    queryKey: ['outstandingTakeouts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name)')
        .eq('user_id', user.id)
        .eq('type', 'takeout')
        .lt('timestamp', twentyFourHoursAgo) // Less than 24 hours ago
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    enabled: !!user && activeTab === 'outstanding-takeouts', // Only run query if user is logged in and tab is active
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  useEffect(() => {
    if (historyError) {
      showError(t('error_fetching_transaction_history') + historyError.message);
    }
  }, [historyError, t]);

  useEffect(() => {
    if (outstandingError) {
      showError(t('error_fetching_outstanding_takeouts') + outstandingError.message);
    }
  }, [outstandingError, t]);

  const handleScanWorker = async () => {
    if (!workerQrCodeInput) {
      showError(t('enter_worker_qr_code_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('qr_code_data', workerQrCodeInput)
      .eq('user_id', user.id) // Filter by user_id
      .single();

    if (error) {
      showError(t('worker_not_found_error') + error.message);
      setScannedWorker(null);
    } else {
      setScannedWorker(data);
      showSuccess(t('worker_found', { workerName: data.name }));
    }
  };

  const handleScanItem = async () => {
    if (!itemBarcodeInput) {
      showError(t('enter_item_barcode_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('*, one_time_use') // Select one_time_use
      .eq('barcode', itemBarcodeInput)
      .eq('user_id', user.id) // Filter by user_id
      .single();

    if (error) {
      showError(t('item_not_found_error') + error.message);
      setScannedItem(null);
    } else {
      setScannedItem(data);
      showSuccess(t('item_found', { itemName: data.name }));
      // If item is one-time use, force transaction type to takeout
      if (data.one_time_use) {
        setTransactionType('takeout');
        showError(t('this_is_one_time_use_item_takeout_only'));
      }
    }
  };

  const handleRecordTransaction = async () => {
    if (!scannedWorker) {
      showError(t('scan_worker_first'));
      return;
    }
    if (!scannedItem) {
      showError(t('scan_item_first'));
      return;
    }
    if (quantityToChange <= 0) {
      showError(t('quantity_greater_than_zero'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    // Prevent return if item is one-time use
    if (scannedItem.one_time_use && transactionType === 'return') {
      showError(t('cannot_return_one_time_use'));
      return;
    }

    let newQuantity = scannedItem.quantity;
    if (transactionType === 'takeout') {
      if (scannedItem.quantity < quantityToChange) {
        showError(t('not_enough_items_in_stock', { available: scannedItem.quantity }));
        return;
      }
      newQuantity -= quantityToChange;
    } else { // type === 'return'
      newQuantity += quantityToChange;
    }

    // Update item quantity
    const { error: updateError } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', scannedItem.id)
      .eq('user_id', user.id); // Ensure user_id is maintained/updated

    if (updateError) {
      showError(t('error_updating_item_quantity') + updateError.message);
      return;
    }

    // Record transaction and select the joined data for optimistic update
    const { data: insertedTransaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          worker_id: scannedWorker.id,
          item_id: scannedItem.id,
          type: transactionType,
          quantity: quantityToChange,
          user_id: user.id // Set user_id
        },
      ])
      .select('*, items(name), workers(name)')
      .single();

    if (transactionError) {
      showError(t('error_recording_transaction') + transactionError.message);
      // Rollback item quantity if transaction fails
      await supabase.from('items').update({ quantity: scannedItem.quantity }).eq('id', scannedItem.id).eq('user_id', user.id);
      return;
    }

    showSuccess(t('recorded_transaction_success', { quantity: quantityToChange, itemName: scannedItem.name, type: transactionType === 'takeout' ? t('taken_by') : t('returned_by'), workerName: scannedWorker.name }));
    setScannedItem({ ...scannedItem, quantity: newQuantity });

    if (insertedTransaction) {
      queryClient.setQueryData<Transaction[]>(['transactions', user.id], (oldData) => {
        const updatedData = oldData ? [insertedTransaction, ...oldData] : [insertedTransaction];
        return updatedData.slice(0, 5);
      });
    }

    queryClient.refetchQueries({ queryKey: ['transactions', user.id] });
    queryClient.refetchQueries({ queryKey: ['outstandingTakeouts', user.id] }); // Refetch outstanding takeouts
  };

  const handleDone = () => {
    setWorkerQrCodeInput('');
    setScannedWorker(null);
    setItemBarcodeInput('');
    setScannedItem(null);
    setQuantityToChange(1);
    setTransactionType('takeout');
    showSuccess(t('transaction_session_cleared'));
    queryClient.refetchQueries({ queryKey: ['transactions', user?.id] });
    queryClient.refetchQueries({ queryKey: ['outstandingTakeouts', user?.id] }); // Refetch outstanding takeouts
  };

  const incrementQuantity = () => {
    setQuantityToChange(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantityToChange(prev => Math.max(1, prev - 1));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-2xl">{t('record_item_transaction')}</CardTitle>
              <CardDescription>{t('scan_worker_then_items')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transaction-form">{t('record_transaction_tab')}</TabsTrigger>
              <TabsTrigger value="outstanding-takeouts">{t('outstanding_takeouts_tab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="transaction-form" className="space-y-6 pt-4">
              {/* Transaction Type Selection */}
              <div className="space-y-2 border-b pb-4">
                <h3 className="text-lg font-semibold">{t('transaction_type')}</h3>
                <ToggleGroup
                  type="single"
                  value={transactionType}
                  onValueChange={(value: 'takeout' | 'return') => {
                    if (scannedItem?.one_time_use && value === 'return') {
                      showError(t('cannot_set_to_return_one_time_use'));
                      return;
                    }
                    value && setTransactionType(value);
                  }}
                  className="flex justify-center gap-4"
                >
                  <ToggleGroupItem 
                    value="takeout" 
                    aria-label="Toggle takeout" 
                    className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:dark:bg-red-900 data-[state=on]:dark:text-red-200"
                  >
                    {t('takeout')}
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="return" 
                    aria-label="Toggle return" 
                    disabled={scannedItem?.one_time_use} // Disable if one-time use
                    className="flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:dark:bg-green-900 data-[state=on]:dark:text-green-200"
                  >
                    {t('return')}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Worker Scan Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Users className="mr-2 h-5 w-5" /> {t('worker_information')}
                </h3>
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder={t('enter_worker_qr_code')}
                    value={workerQrCodeInput}
                    onChange={(e) => setWorkerQrCodeInput(e.target.value)}
                    className="flex-grow"
                    disabled={!!scannedWorker}
                  />
                  <Button onClick={handleScanWorker} disabled={!!scannedWorker}>
                    <QrCode className="mr-2 h-4 w-4" /> {t('scan_worker')}
                  </Button>
                </div>
                {scannedWorker && (
                  <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                    <p><strong>{t('name')}:</strong> {scannedWorker.name}</p>
                    <p><strong>{t('company')}:</strong> {scannedWorker.company || 'N/A'}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => { setScannedWorker(null); setWorkerQrCodeInput(''); }}>
                      {t('change_worker')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Item Scan Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Package className="mr-2 h-5 w-5" /> {t('item_information')}
                </h3>
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder={t('enter_item_barcode')}
                    value={itemBarcodeInput}
                    onChange={(e) => setItemBarcodeInput(e.target.value)}
                    className="flex-grow"
                  />
                  <Button onClick={handleScanItem}>
                    <Barcode className="mr-2 h-4 w-4" /> {t('scan_item')}
                  </Button>
                </div>

                {scannedItem && (
                  <div className="border p-3 rounded-md space-y-2 bg-gray-50 dark:bg-gray-800">
                    <h4 className="text-md font-semibold">{scannedItem.name}</h4>
                    <p><strong>{t('description')}:</strong> {scannedItem.description || 'N/A'}</p>
                    <p><strong>{t('current_quantity')}:</strong> {scannedItem.quantity}</p>
                    <p><strong>{t('barcode')}:</strong> {scannedItem.barcode}</p>
                    {scannedItem.one_time_use && (
                      <p className="text-sm text-red-500 font-semibold">{t('this_is_one_time_use_item')}</p>
                    )}

                    <div className="space-y-2 mt-4">
                      <Label htmlFor="quantityToChange">{t('quantity_to_change', { type: transactionType === 'takeout' ? t('take') : t('return') })}:</Label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantityToChange <= 1}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="quantityToChange"
                          type="number"
                          value={quantityToChange}
                          onChange={(e) => setQuantityToChange(parseInt(e.target.value) || 1)}
                          min="1"
                          className="text-center"
                        />
                        <Button variant="outline" size="icon" onClick={incrementQuantity}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button onClick={handleRecordTransaction} className="w-full" disabled={!scannedWorker || !scannedItem}>
                        {t(transactionType === 'takeout' ? 'record_takeout' : 'record_return')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Done Button */}
              <div className="pt-4 border-t">
                <Button onClick={handleDone} className="w-full">
                  {t('done_with_current_transaction')}
                </Button>
              </div>

              {/* Recent Transaction History Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold flex items-center">
                  <HistoryIcon className="mr-2 h-5 w-5" /> {t('recent_transaction_history')}
                </h3>
                {isHistoryLoading ? (
                  <p className="text-gray-500">{t('loading_history')}</p>
                ) : transactionsHistory && transactionsHistory.length > 0 ? (
                  <div className="space-y-2">
                    {transactionsHistory.map((transaction) => (
                      <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                        <p><strong>{t('worker')}:</strong> {transaction.workers?.name || 'N/A'}</p>
                        <p><strong>{t('item')}:</strong> {transaction.items?.name || 'N/A'}</p>
                        <p>
                          <strong>{t('type')}:</strong>{' '}
                          <span
                            className={`font-medium px-2 py-1 rounded-full text-xs ${
                              transaction.type === 'takeout'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                            }`}
                          >
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                          </span>
                        </p>
                        <p><strong>{t('quantity')}:</strong> {transaction.quantity}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">{t('no_recent_transactions')}</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="outstanding-takeouts" className="space-y-6 pt-4">
              <h3 className="text-lg font-semibold flex items-center">
                <HistoryIcon className="mr-2 h-5 w-5" /> {t('outstanding_takeouts_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('outstanding_takeouts_description')}
              </p>
              {isOutstandingLoading ? (
                <p className="text-gray-500">{t('loading_outstanding_takeouts')}</p>
              ) : outstandingTakeouts && outstandingTakeouts.length > 0 ? (
                <div className="space-y-2">
                  {outstandingTakeouts.map((transaction) => (
                    <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                      <p><strong>{t('worker')}:</strong> {transaction.workers?.name || 'N/A'}</p>
                      <p><strong>{t('item')}:</strong> {transaction.items?.name || 'N/A'}</p>
                      <p><strong>{t('quantity')}:</strong> {transaction.quantity}</p>
                      <p className="text-xs text-gray-500">
                        {t('taken_on')}: {new Date(transaction.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">{t('no_outstanding_takeouts')}</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerTransaction;