import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { QrCode, Barcode, ArrowLeft, Package, Users, History as HistoryIcon, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Worker {
  id: string;
  name: string;
  company: string | null;
  qr_code_data: string | null;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
}

interface Transaction {
  id: string;
  item_id: string;
  worker_id: string;
  type: string;
  quantity: number;
  timestamp: string;
  items: { name: string };
  workers: { name: string };
}

const WorkerTransaction = () => {
  const [workerQrCodeInput, setWorkerQrCodeInput] = useState('');
  const [scannedWorker, setScannedWorker] = useState<Worker | null>(null);
  const [itemBarcodeInput, setItemBarcodeInput] = useState('');
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [quantityToTake, setQuantityToTake] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch transaction history
  const { data: transactionsHistory, isLoading: isHistoryLoading, error: historyError } = useQuery<Transaction[], Error>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name)')
        .order('timestamp', { ascending: false })
        .limit(5); // Show last 5 transactions

      if (error) {
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    staleTime: 1000 * 10, // Refresh history every 10 seconds
  });

  useEffect(() => {
    if (historyError) {
      showError('Error fetching transaction history: ' + historyError.message);
    }
  }, [historyError]);

  const handleScanWorker = async () => {
    if (!workerQrCodeInput) {
      showError('Please enter a worker QR code to scan.');
      return;
    }

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('qr_code_data', workerQrCodeInput)
      .single();

    if (error) {
      showError('Worker not found or error fetching worker: ' + error.message);
      setScannedWorker(null);
    } else {
      setScannedWorker(data);
      showSuccess(`Worker "${data.name}" found!`);
    }
  };

  const handleScanItem = async () => {
    if (!itemBarcodeInput) {
      showError('Please enter an item barcode to scan.');
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', itemBarcodeInput)
      .single();

    if (error) {
      showError('Item not found or error fetching item: ' + error.message);
      setScannedItem(null);
    } else {
      setScannedItem(data);
      showSuccess(`Item "${data.name}" found!`);
    }
  };

  const handleRecordTakeout = async () => {
    if (!scannedWorker) {
      showError('Please scan a worker first.');
      return;
    }
    if (!scannedItem) {
      showError('Please scan an item first.');
      return;
    }
    if (quantityToTake <= 0) {
      showError('Quantity to take must be greater than zero.');
      return;
    }
    if (scannedItem.quantity < quantityToTake) {
      showError(`Not enough items in stock. Available: ${scannedItem.quantity}`);
      return;
    }

    const newQuantity = scannedItem.quantity - quantityToTake;

    // Update item quantity
    const { error: updateError } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', scannedItem.id);

    if (updateError) {
      showError('Error updating item quantity: ' + updateError.message);
      return;
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          worker_id: scannedWorker.id,
          item_id: scannedItem.id,
          type: 'takeout',
          quantity: quantityToTake,
        },
      ]);

    if (transactionError) {
      showError('Error recording transaction: ' + transactionError.message);
      // Optionally, revert item quantity if transaction fails
      await supabase.from('items').update({ quantity: scannedItem.quantity }).eq('id', scannedItem.id);
      return;
    }

    showSuccess(`Recorded ${quantityToTake} of "${scannedItem.name}" taken by "${scannedWorker.name}".`);
    // Update local state for current item
    setScannedItem({ ...scannedItem, quantity: newQuantity });
    // Refetch transactions query to refresh history immediately
    queryClient.refetchQueries({ queryKey: ['transactions'] });
  };

  const handleDone = () => {
    setWorkerQrCodeInput('');
    setScannedWorker(null);
    setItemBarcodeInput('');
    setScannedItem(null);
    setQuantityToTake(1);
    showSuccess('Transaction session cleared. Ready for new entry!');
  };

  const incrementQuantity = () => {
    setQuantityToTake(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantityToTake(prev => Math.max(1, prev - 1)); // Ensure quantity doesn't go below 1
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
              <CardTitle className="text-2xl">Record Item Takeout</CardTitle>
              <CardDescription>Scan worker, then scan items they are taking.</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Worker Scan Section */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Users className="mr-2 h-5 w-5" /> Worker Information
            </h3>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Enter worker QR code data"
                value={workerQrCodeInput}
                onChange={(e) => setWorkerQrCodeInput(e.target.value)}
                className="flex-grow"
                disabled={!!scannedWorker} // Disable if worker is already scanned
              />
              <Button onClick={handleScanWorker} disabled={!!scannedWorker}>
                <QrCode className="mr-2 h-4 w-4" /> Scan Worker
              </Button>
            </div>
            {scannedWorker && (
              <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                <p><strong>Name:</strong> {scannedWorker.name}</p>
                <p><strong>Company:</strong> {scannedWorker.company || 'N/A'}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { setScannedWorker(null); setWorkerQrCodeInput(''); }}>
                  Change Worker
                </Button>
              </div>
            )}
          </div>

          {/* Item Scan Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Package className="mr-2 h-5 w-5" /> Item Information
            </h3>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Enter item barcode"
                value={itemBarcodeInput}
                onChange={(e) => setItemBarcodeInput(e.target.value)}
                className="flex-grow"
              />
              <Button onClick={handleScanItem}>
                <Barcode className="mr-2 h-4 w-4" /> Scan Item
              </Button>
            </div>

            {scannedItem && (
              <div className="border p-3 rounded-md space-y-2 bg-gray-50 dark:bg-gray-800">
                <h4 className="text-md font-semibold">{scannedItem.name}</h4>
                <p><strong>Description:</strong> {scannedItem.description || 'N/A'}</p>
                <p><strong>Current Quantity:</strong> {scannedItem.quantity}</p>
                <p><strong>Barcode:</strong> {scannedItem.barcode}</p>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="quantityToTake">Quantity to Take:</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantityToTake <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="quantityToTake"
                      type="number"
                      value={quantityToTake}
                      onChange={(e) => setQuantityToTake(parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-center"
                    />
                    <Button variant="outline" size="icon" onClick={incrementQuantity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={handleRecordTakeout} className="w-full" disabled={!scannedWorker || !scannedItem}>
                    Record Takeout
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Done Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleDone} className="w-full">
              Done with Current Transaction
            </Button>
          </div>

          {/* Transaction History Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold flex items-center">
              <HistoryIcon className="mr-2 h-5 w-5" /> Recent Takeout History
            </h3>
            {isHistoryLoading ? (
              <p className="text-gray-500">Loading history...</p>
            ) : transactionsHistory && transactionsHistory.length > 0 ? (
              <div className="space-y-2">
                {transactionsHistory.map((transaction) => (
                  <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                    <p><strong>Worker:</strong> {transaction.workers?.name || 'N/A'}</p>
                    <p><strong>Item:</strong> {transaction.items?.name || 'N/A'}</p>
                    <p><strong>Quantity:</strong> {transaction.quantity}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No recent takeouts recorded.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerTransaction;