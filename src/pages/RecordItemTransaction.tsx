import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, QrCode, Camera, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { DebounceInput } from 'react-debounce-input';

// Interfaces
interface Item {
  id: string;
  name: string;
  quantity: number;
  barcode: string | null;
  one_time_use: boolean;
  is_tool: boolean;
  is_ppe: boolean;
}
interface Worker {
  id: string;
  name: string;
}
interface Company {
  id: string;
  name: string;
}
interface TransactionItem extends Item {
  transactionQuantity: number;
  transactionType: 'takeout' | 'return';
}

const RecordItemTransaction = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Recipient State
  const [selectedRecipientType, setSelectedRecipientType] = useState<'worker' | 'company'>('worker');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [selectedRecipientName, setSelectedRecipientName] = useState<string | null>(null);
  const [isScanningWorker, setIsScanningWorker] = useState(false);
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const { data: searchedWorkers } = useQuery({
    queryKey: ['searchWorkers', workerSearchTerm],
    queryFn: async () => {
      if (!workerSearchTerm) return [];
      const { data } = await supabase.from('workers').select('id, name').ilike('name', `%${workerSearchTerm}%`);
      return data;
    },
    enabled: !!workerSearchTerm,
  });
  const { data: companies } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: () => supabase.from('companies').select('id, name'),
    select: (res) => res.data,
  });

  // Item State
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isScanningItem, setIsScanningItem] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const { data: searchedItems } = useQuery({
    queryKey: ['searchItems', itemSearchTerm],
    queryFn: async () => {
      if (!itemSearchTerm) return [];
      const { data } = await supabase.from('items').select('id, name, quantity, barcode, one_time_use, is_tool, is_ppe').ilike('name', `%${itemSearchTerm}%`);
      return data;
    },
    enabled: !!itemSearchTerm,
  });

  // Transaction State
  const [transactionList, setTransactionList] = useState<TransactionItem[]>([]);
  const [transactionType, setTransactionType] = useState<'takeout' | 'return'>('takeout');
  const [quantity, setQuantity] = useState(1);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isTakeoutOnly = useMemo(() => selectedItem?.one_time_use || selectedItem?.is_ppe, [selectedItem]);

  useEffect(() => {
    if (isTakeoutOnly) {
      setTransactionType('takeout');
    }
  }, [isTakeoutOnly]);

  const handleRecipientSelect = (id: string, name: string, type: 'worker' | 'company') => {
    if (transactionList.length > 0 && window.confirm(t('confirm_clear_worker_with_items'))) {
      setTransactionList([]);
    }
    setSelectedRecipientId(id);
    setSelectedRecipientName(name);
    setSelectedRecipientType(type);
    setWorkerSearchTerm('');
  };

  const clearRecipient = () => {
    if (transactionList.length > 0 && window.confirm(t('confirm_clear_worker_with_items'))) {
      setTransactionList([]);
    }
    setSelectedRecipientId(null);
    setSelectedRecipientName(null);
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setItemSearchTerm('');
  };

  const clearItem = () => {
    setSelectedItem(null);
    setQuantity(1);
  };

  const handleBarcodeScanned = async (barcode: string, type: 'worker' | 'item') => {
    setIsScanningWorker(false);
    setIsScanningItem(false);
    if (type === 'worker') {
      const { data } = await supabase.from('workers').select('id, name').eq('id', barcode).single();
      if (data) handleRecipientSelect(data.id, data.name, 'worker');
      else showError(t('worker_not_found_error'));
    } else {
      const { data } = await supabase.from('items').select('id, name, quantity, barcode, one_time_use, is_tool, is_ppe').eq('barcode', barcode).single();
      if (data) handleItemSelect(data);
      else showError(t('item_not_found_error'));
    }
  };

  const addItemToList = () => {
    if (!selectedItem) {
      showError(t('scan_item_first'));
      return;
    }
    if (quantity <= 0) {
      showError(t('quantity_greater_than_zero'));
      return;
    }
    if (transactionType === 'takeout' && quantity > selectedItem.quantity) {
      showError(t('not_enough_items_in_stock', { available: selectedItem.quantity }));
      return;
    }

    const existingItemIndex = transactionList.findIndex(item => item.id === selectedItem.id && item.transactionType === transactionType);
    if (existingItemIndex !== -1) {
      const updatedList = [...transactionList];
      updatedList[existingItemIndex].transactionQuantity += quantity;
      setTransactionList(updatedList);
    } else {
      setTransactionList([...transactionList, { ...selectedItem, transactionQuantity: quantity, transactionType }]);
    }
    showSuccess(t('item_added_to_list', { itemName: selectedItem.name }));
    clearItem();
  };

  const removeFromList = (index: number) => {
    const newList = [...transactionList];
    newList.splice(index, 1);
    setTransactionList(newList);
  };

  const handleFinalizeTransactions = async () => {
    if (transactionList.length === 0) {
      showError(t('no_items_in_transaction_list'));
      return;
    }
    if (!selectedRecipientId) {
      showError(t('scan_worker_first'));
      return;
    }
    setIsProcessing(true);
    let allSucceeded = true;
    const ppeAssignments = new Map<string, { item: Item, quantity: number }>();

    for (const transaction of transactionList) {
      try {
        const { data: currentItem, error: fetchError } = await supabase
          .from('items')
          .select('quantity')
          .eq('id', transaction.id)
          .single();

        if (fetchError) throw new Error(t('error_fetching_item_details_for', { itemName: transaction.name }));

        let newQuantity;
        if (transaction.transactionType === 'takeout') {
          if (currentItem.quantity < transaction.transactionQuantity) {
            throw new Error(t('not_enough_stock_for_item', { itemName: transaction.name }));
          }
          newQuantity = currentItem.quantity - transaction.transactionQuantity;
        } else { // return
          newQuantity = currentItem.quantity + transaction.transactionQuantity;
        }

        const { error: updateError } = await supabase
          .from('items')
          .update({ quantity: newQuantity })
          .eq('id', transaction.id);
        if (updateError) throw new Error(t('error_updating_quantity_for', { itemName: transaction.name }));

        const { error: transactionError } = await supabase.from('transactions').insert({
          item_id: transaction.id,
          worker_id: selectedRecipientType === 'worker' ? selectedRecipientId : null,
          company_id: selectedRecipientType === 'company' ? selectedRecipientId : null,
          type: transaction.transactionType,
          quantity: transaction.transactionQuantity,
          user_id: user?.id,
          authorized_by: authorizedBy || null,
          given_by: givenBy || null,
          application_location: applicationLocation || null,
        });
        if (transactionError) throw new Error(t('error_recording_transaction_for', { itemName: transaction.name }));

        if (transaction.transactionType === 'takeout' && transaction.is_ppe) {
            const existing = ppeAssignments.get(transaction.id);
            const updatedQuantity = (existing?.quantity || 0) + transaction.transactionQuantity;
            ppeAssignments.set(transaction.id, { item: transaction, quantity: updatedQuantity });
        }

      } catch (error) {
        showError(error.message);
        allSucceeded = false;
        break;
      }
    }

    if (allSucceeded) {
        if (ppeAssignments.size > 0 && selectedRecipientId && selectedRecipientType === 'worker') {
            try {
              const { data: workerData, error: workerError } = await supabase
                .from('workers')
                .select('assigned_ppes')
                .eq('id', selectedRecipientId)
                .single();
        
              if (workerError) throw workerError;
        
              const currentPpes = workerData.assigned_ppes || [];
              
              ppeAssignments.forEach((assignment, itemId) => {
                const newPpeEntry = {
                  itemId: itemId,
                  itemName: assignment.item.name,
                  quantity: assignment.quantity,
                  dateAssigned: new Date().toISOString(),
                };
        
                const existingPpeIndex = currentPpes.findIndex(p => p.itemId === itemId);
                if (existingPpeIndex > -1) {
                  currentPpes[existingPpeIndex].quantity += newPpeEntry.quantity;
                  currentPpes[existingPpeIndex].dateAssigned = newPpeEntry.dateAssigned;
                } else {
                  currentPpes.push(newPpeEntry);
                }
              });
        
              const { error: updateError } = await supabase
                .from('workers')
                .update({ assigned_ppes: currentPpes })
                .eq('id', selectedRecipientId);
        
              if (updateError) throw updateError;
              
              showSuccess(t('ppes_assigned_successfully'));
            } catch (error) {
              showError(t('error_assigning_ppes', { error: error.message }));
            }
        }
        showSuccess(t('all_transactions_recorded_successfully'));
        setTransactionList([]);
        clearRecipient();
        clearItem();
        setAuthorizedBy('');
        setGivenBy('');
        setApplicationLocation('');
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {isScanningWorker && <BarcodeScanner onScan={(barcode) => handleBarcodeScanned(barcode, 'worker')} onCancel={() => setIsScanningWorker(false)} />}
      {isScanningItem && <BarcodeScanner onScan={(barcode) => handleBarcodeScanned(barcode, 'item')} onCancel={() => setIsScanningItem(false)} />}

      <div className="lg:col-span-2 space-y-4">
        {/* Recipient Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recipient')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRecipientId ? (
              <div className="space-y-4">
                <RadioGroup value={selectedRecipientType} onValueChange={(v) => setSelectedRecipientType(v as 'worker' | 'company')} className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="worker" id="worker" /><Label htmlFor="worker">{t('worker')}</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="company" id="company" /><Label htmlFor="company">{t('company')}</Label></div>
                </RadioGroup>
                {selectedRecipientType === 'worker' ? (
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setIsScanningWorker(true)}><QrCode className="mr-2 h-4 w-4" /> {t('scan_worker_qr')}</Button>
                    <div className="relative flex-grow">
                      <DebounceInput
                        minLength={2}
                        debounceTimeout={300}
                        element={Input}
                        placeholder={t('search_worker_by_name')}
                        value={workerSearchTerm}
                        onChange={(e) => setWorkerSearchTerm(e.target.value)}
                      />
                      {searchedWorkers && searchedWorkers.length > 0 && (
                        <Card className="absolute z-10 w-full mt-1">
                          {searchedWorkers.map(w => <div key={w.id} onClick={() => handleRecipientSelect(w.id, w.name, 'worker')} className="p-2 hover:bg-secondary cursor-pointer">{w.name}</div>)}
                        </Card>
                      )}
                    </div>
                  </div>
                ) : (
                  <Select onValueChange={(id) => handleRecipientSelect(id, companies?.find(c => c.id === id)?.name || '', 'company')}>
                    <SelectTrigger><SelectValue placeholder={t('select_a_company')} /></SelectTrigger>
                    <SelectContent>
                      {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">{selectedRecipientName}</p>
                <Button variant="ghost" size="icon" onClick={clearRecipient}><X className="h-5 w-5" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('item_information')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedItem ? (
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsScanningItem(true)}><Camera className="mr-2 h-4 w-4" /> {t('scan_by_barcode')}</Button>
                <div className="relative flex-grow">
                  <DebounceInput
                    minLength={2}
                    debounceTimeout={300}
                    element={Input}
                    placeholder={t('search_by_name')}
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                  />
                  {searchedItems && searchedItems.length > 0 && (
                    <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                      {searchedItems.map(i => <div key={i.id} onClick={() => handleItemSelect(i)} className="p-2 hover:bg-secondary cursor-pointer">{i.name}</div>)}
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-lg">{selectedItem.name}</p>
                  <Button variant="ghost" size="icon" onClick={clearItem}><X className="h-5 w-5" /></Button>
                </div>
                <p>{t('current_quantity')}: {selectedItem.quantity}</p>
                {isTakeoutOnly && <p className="text-orange-600">{t('this_item_is_takeout_only')}</p>}
                <div className="flex items-center gap-4">
                  <RadioGroup value={transactionType} onValueChange={(v) => setTransactionType(v as 'takeout' | 'return')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="takeout" id="takeout" /><Label htmlFor="takeout">{t('takeout')}</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="return" id="return" disabled={isTakeoutOnly} /><Label htmlFor="return" className={isTakeoutOnly ? 'text-muted-foreground' : ''}>{t('return')}</Label></div>
                  </RadioGroup>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                    <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-16 text-center" />
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Button onClick={addItemToList} disabled={!selectedRecipientId}>{t('add_item_to_list')}</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Details Card */}
        <Card>
            <CardHeader><CardTitle>{t('transaction_details')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="authorizedBy">{t('authorized_by')}</Label><Input id="authorizedBy" value={authorizedBy} onChange={e => setAuthorizedBy(e.target.value)} /></div>
                <div><Label htmlFor="givenBy">{t('given_by')}</Label><Input id="givenBy" value={givenBy} onChange={e => setGivenBy(e.target.value)} /></div>
                <div className="md:col-span-2"><Label htmlFor="location">{t('application_location')}</Label><Input id="location" value={applicationLocation} onChange={e => setApplicationLocation(e.target.value)} /></div>
            </CardContent>
        </Card>
      </div>

      {/* Transaction List Card */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>{t('transaction_list')}</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionList.length === 0 ? (
              <p className="text-center text-muted-foreground">{t('no_items_added_yet')}</p>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('item')}</TableHead>
                      <TableHead>{t('quantity')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionList.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.transactionQuantity}</TableCell>
                        <TableCell>{t(item.transactionType)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeFromList(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={handleFinalizeTransactions} className="w-full" disabled={isProcessing}>
                  {isProcessing ? t('processing_transactions') : t('finalize_transactions')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RecordItemTransaction;