import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, type NavigateFunction, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Item, Worker, Kit, Transaction } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Outbox } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import Scanner from '@/components/worker-transaction/Scanner';
import WorkerSelection from '@/components/worker-transaction/WorkerSelection';
import ItemSelection from '@/components/worker-transaction/ItemSelection';
import TransactionList from '@/components/worker-transaction/TransactionList';
import TransactionMeta from '@/components/worker-transaction/TransactionMeta';
import OutstandingItems from '@/components/worker-transaction/OutstandingItems';
import RecentTransactions from '@/components/worker-transaction/RecentTransactions';

interface TransactionItem {
  item: Item;
  quantity: number;
  type: 'takeout' | 'return';
  is_broken?: boolean;
}

const WorkerTransaction = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workerQrCodeInput, setWorkerQrCodeInput] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [workerSearchResults, setWorkerSearchResults] = useState<Worker[]>([]);
  const [scannedWorker, setScannedWorker] = useState<Worker | null>(null);
  const [itemBarcodeInput, setItemBarcodeInput] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [quantityToChange, setQuantityToChange] = useState(1);
  const [transactionType, setTransactionType] = useState<'takeout' | 'return'>('takeout');
  const [isBroken, setIsBroken] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');
  const [activeTab, setActiveTab] = useState('transaction-form');
  const navigate: NavigateFunction = useNavigate();

  const [selectionMode, setSelectionMode] = useState<'worker' | 'company'>('worker');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const [scanningWorker, setScanningWorker] = useState(false);
  const [scanningItem, setScanningItem] = useState(false);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [isKitDialogOpen, setIsKitDialogOpen] = useState(false);

  const allWorkers = useLiveQuery(() => db.workers.toArray(), []);
  const allItems = useLiveQuery(() => db.items.toArray(), []);
  const kits = useLiveQuery(() => db.kits.toArray(), []);

  const companies = useMemo(() => {
    if (!allWorkers) return [];
    const uniqueCompanies = [...new Set(allWorkers.map(w => w.company).filter(Boolean))] as string[];
    return uniqueCompanies.sort();
  }, [allWorkers]);

  const handleScanWorker = (qrCodeData: string) => {
    if (!qrCodeData) { showError(t('enter_worker_qr_code_scan')); return; }
    const worker = allWorkers?.find(w => w.qr_code_data === qrCodeData || w.external_qr_code_data === qrCodeData);
    if (worker) {
      setScannedWorker(worker);
      showSuccess(t('worker_found', { workerName: worker.name }));
      setWorkerQrCodeInput(qrCodeData);
      setWorkerSearchTerm('');
      setWorkerSearchResults([]);
    } else {
      showError(t('worker_not_found_error'));
      setScannedWorker(null);
    }
  };

  const handleSearchWorkerByName = () => {
    if (!workerSearchTerm.trim()) { showError(t('enter_worker_name_to_search')); return; }
    const results = allWorkers?.filter(w => w.name.toLowerCase().includes(workerSearchTerm.trim().toLowerCase())) || [];
    if (results.length > 0) {
      if (results.length === 1) {
        handleSelectWorker(results[0]);
      } else {
        setWorkerSearchResults(results);
        showSuccess(t('multiple_workers_found_select'));
      }
    } else {
      showError(t('no_workers_found_for_name'));
      setWorkerSearchResults([]);
    }
  };

  const handleSelectWorker = (worker: Worker) => {
    setScannedWorker(worker);
    setWorkerQrCodeInput(worker.qr_code_data || worker.external_qr_code_data || '');
    setWorkerSearchTerm(worker.name);
    setWorkerSearchResults([]);
    showSuccess(t('worker_selected', { workerName: worker.name }));
  };

  const handleClearWorker = () => {
    if (transactionItems.length > 0) {
      if (window.confirm(t('confirm_clear_worker_with_items'))) {
        setTransactionItems([]);
      } else {
        return;
      }
    }
    setScannedWorker(null);
    setWorkerQrCodeInput('');
    setWorkerSearchTerm('');
    setWorkerSearchResults([]);
    setSelectedCompany(null);
    showSuccess(t('selection_cleared'));
  };

  const handleScanItem = (scannedBarcode?: string) => {
    const barcodeToSearch = scannedBarcode || itemBarcodeInput;
    if (!barcodeToSearch) { showError(t('enter_item_barcode_scan')); return; }
    const item = allItems?.find(i => i.barcode === barcodeToSearch);
    if (item) {
      setScannedItem(item);
      showSuccess(t('item_found', { itemName: item.name }));
      setItemSearchTerm(item.name);
      setItemSearchResults([]);
      if (item.one_time_use) {
        setTransactionType('takeout');
        showError(t('this_is_one_time_use_item_takeout_only'));
      }
    } else {
      showError(t('item_not_found_error'));
      setScannedItem(null);
      setItemSearchTerm('');
      setItemSearchResults([]);
    }
  };

  const handleSearchItemByName = () => {
    if (!itemSearchTerm.trim()) { showError(t('enter_item_name_to_search')); return; }
    const results = allItems?.filter(i => i.name.toLowerCase().includes(itemSearchTerm.trim().toLowerCase())) || [];
    if (results.length > 0) {
      if (results.length === 1) {
        handleSelectItem(results[0]);
      } else {
        setItemSearchResults(results);
        showSuccess(t('multiple_items_found_select'));
      }
    } else {
      showError(t('no_items_found_for_name'));
      setItemSearchResults([]);
    }
  };

  const handleSelectItem = (item: Item) => {
    setScannedItem(item);
    setItemBarcodeInput(item.barcode || '');
    setItemSearchTerm(item.name);
    setItemSearchResults([]);
    showSuccess(t('item_selected', { itemName: item.name }));
    if (item.one_time_use) {
      setTransactionType('takeout');
      showError(t('this_is_one_time_use_item_takeout_only'));
    }
  };

  const handleClearItem = () => {
    setScannedItem(null);
    setItemBarcodeInput('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    showSuccess(t('item_selection_cleared'));
  };

  const handleAddItemToList = async () => {
    if (!scannedItem) { showError(t('scan_item_first')); return; }
    if (quantityToChange <= 0) { showError(t('quantity_greater_than_zero')); return; }
    if (transactionType === 'takeout' && scannedItem.quantity < quantityToChange) {
      showError(t('not_enough_items_in_stock', { available: scannedItem.quantity }));
      return;
    }

    setTransactionItems(prev => [...prev, {
      item: scannedItem,
      quantity: quantityToChange,
      type: transactionType,
      is_broken: transactionType === 'return' ? isBroken : false,
    }]);

    showSuccess(t('item_added_to_list', { itemName: scannedItem.name }));

    setScannedItem(null);
    setItemBarcodeInput('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setQuantityToChange(1);
    setIsBroken(false);
  };

  const handleRemoveItemFromList = (indexToRemove: number) => {
    setTransactionItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFinalizeTransactions = async () => {
    if (transactionItems.length === 0) { showError(t('no_items_in_transaction_list')); return; }
    if (selectionMode === 'worker' && !scannedWorker) { showError(t('scan_worker_first')); return; }
    if (selectionMode === 'company' && !selectedCompany) { showError(t('select_company_first')); return; }
    if (!user) { showError(t('user_not_authenticated_login')); return; }

    const toastId = showLoading(t('saving_transaction_locally'));
    
    try {
      const outboxOps: Outbox[] = [];
      const localItemUpdates: { id: string, newQuantity: number }[] = [];
      const localTransactions: Transaction[] = [];

      for (const txItem of transactionItems) {
        if (txItem.type === 'takeout' && txItem.item.requires_requisition) {
          let approvedRequisitions;
          if (selectionMode === 'worker' && scannedWorker) {
            approvedRequisitions = await db.requisitions.where({ status: 'approved', requester_name: scannedWorker.name }).toArray();
          } else if (selectionMode === 'company' && selectedCompany) {
            approvedRequisitions = await db.requisitions.where({ status: 'approved', requester_company: selectedCompany }).toArray();
          } else {
            throw new Error('No recipient selected for requisition check.');
          }

          let hasApproval = false;
          for (const req of approvedRequisitions) {
            const reqItem = await db.requisition_items.where({ requisition_id: req.id, item_id: txItem.item.id }).first();
            if (reqItem && reqItem.quantity >= txItem.quantity) {
              hasApproval = true;
              break;
            }
          }

          if (!hasApproval) {
            throw new Error(t('no_approved_requisition_found', { itemName: txItem.item.name }));
          }
        }

        const currentItem = await db.items.get(txItem.item.id);
        if (!currentItem) throw new Error(`Item ${txItem.item.name} not found locally.`);

        let newQuantity = currentItem.quantity;
        if (txItem.type === 'takeout') {
          if (currentItem.quantity < txItem.quantity) throw new Error(t('not_enough_stock_for_item', { itemName: txItem.item.name }));
          newQuantity -= txItem.quantity;
        } else if (txItem.type === 'return' && !txItem.is_broken) {
          newQuantity += txItem.quantity;
        }
        
        if (newQuantity !== currentItem.quantity) {
          localItemUpdates.push({ id: txItem.item.id, newQuantity });
          outboxOps.push({ type: 'update', table: 'items', payload: { id: txItem.item.id, quantity: newQuantity }, timestamp: Date.now() });
        }

        const newTransaction: Transaction = {
          id: uuidv4(),
          item_id: txItem.item.id,
          worker_id: selectionMode === 'worker' ? scannedWorker!.id : null,
          company: selectionMode === 'company' ? selectedCompany : (scannedWorker?.company || null),
          type: txItem.type,
          quantity: txItem.quantity,
          timestamp: new Date().toISOString(),
          user_id: user.id,
          authorized_by: authorizedBy.trim() || null,
          given_by: givenBy.trim() || null,
          requisition_id: null,
          is_broken: txItem.is_broken || false,
        };
        localTransactions.push(newTransaction);
        outboxOps.push({ type: 'create', table: 'transactions', payload: newTransaction, timestamp: Date.now() });
      }

      await db.transaction('rw', db.items, db.transactions, db.outbox, async () => {
        for (const update of localItemUpdates) {
          await db.items.update(update.id, { quantity: update.newQuantity });
        }
        await db.transactions.bulkAdd(localTransactions);
        await db.outbox.bulkAdd(outboxOps as any);
      });

      dismissToast(toastId);
      showSuccess(t('transaction_saved_locally_and_queued'));
      handleDone();

    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message);
    }
  };

  const handleDone = () => {
    setWorkerQrCodeInput(''); setWorkerSearchTerm(''); setWorkerSearchResults([]);
    setScannedWorker(null); setItemBarcodeInput(''); setItemSearchTerm('');
    setItemSearchResults([]); setScannedItem(null); setQuantityToChange(1);
    setTransactionType('takeout'); setAuthorizedBy(''); setGivenBy('');
    setApplicationLocation(''); setSelectedCompany(null); setSelectionMode('worker');
    setTransactionItems([]);
    showSuccess(t('transaction_session_cleared'));
  };

  const handleSelectKit = async (kitId: string) => {
    const toastId = showLoading(t('adding_items_from_kit'));
    try {
      const kitItems = await db.kit_items.where('kit_id').equals(kitId).toArray();
      if (!kitItems || kitItems.length === 0) { showError(t('kit_is_empty')); return; }
      const itemsToAdd: TransactionItem[] = [];
      let stockError = false;
      for (const ki of kitItems) {
        const item = await db.items.get(ki.item_id);
        if (!item) continue;
        if (item.quantity < ki.quantity) {
          showError(`Not enough stock for ${item.name}. Required: ${ki.quantity}, Available: ${item.quantity}`);
          stockError = true;
          break;
        }
        itemsToAdd.push({ item, quantity: ki.quantity, type: 'takeout', is_broken: false });
      }
      if (!stockError) {
        setTransactionItems(prev => [...prev, ...itemsToAdd]);
        showSuccess(t('items_from_kit_added'));
        setIsKitDialogOpen(false);
      }
    } catch (error: any) { showError(error.message); } finally { dismissToast(toastId); }
  };

  return (
    <React.Fragment>
      {(scanningWorker || scanningItem) && (
        <Scanner
          readerElementId={scanningWorker ? "worker-qr-reader" : "item-barcode-reader"}
          onScanSuccess={(text) => {
            if (scanningWorker) { handleScanWorker(text); setScanningWorker(false); }
            if (scanningItem) { handleScanItem(text); setScanningItem(false); }
          }}
          onClose={() => { setScanningWorker(false); setScanningItem(false); }}
        />
      )}

      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        <Card className={`w-full max-w-md ${scanningWorker || scanningItem ? 'hidden' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-2xl">{t('record_item_transaction')}</CardTitle>
                <CardDescription>{t('scan_worker_then_items')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transaction-form">{t('record_transaction_tab')}</TabsTrigger>
                <TabsTrigger value="outstanding-takeouts">{t('outstanding_takeouts_tab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="transaction-form" className="space-y-6 pt-4">
                <div className="space-y-2 border-b pb-4">
                  <h3 className="text-lg font-semibold">{t('transaction_type')}</h3>
                  <ToggleGroup type="single" value={transactionType} onValueChange={(value: 'takeout' | 'return') => { if (scannedItem?.one_time_use && value === 'return') { showError(t('cannot_set_to_return_one_time_use')); return; } value && setTransactionType(value); }} className="flex justify-center gap-4">
                    <ToggleGroupItem value="takeout" aria-label="Toggle takeout" className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:dark:bg-red-900 data-[state=on]:dark:text-red-200">{t('takeout')}</ToggleGroupItem>
                    <ToggleGroupItem value="return" aria-label="Toggle return" disabled={scannedItem?.one_time_use} className="flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:dark:bg-green-900 data-[state=on]:dark:text-green-200">{t('return')}</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <WorkerSelection
                  selectionMode={selectionMode} onSelectionModeChange={(mode) => { setSelectionMode(mode); handleClearWorker(); }}
                  scannedWorker={scannedWorker} workerQrCodeInput={workerQrCodeInput} onWorkerQrCodeInputChange={setWorkerQrCodeInput}
                  onStartWorkerScan={() => setScanningWorker(true)} onScanWorker={handleScanWorker}
                  workerSearchTerm={workerSearchTerm} onWorkerSearchTermChange={setWorkerSearchTerm}
                  onSearchWorkerByName={handleSearchWorkerByName} workerSearchResults={workerSearchResults}
                  onSelectWorker={handleSelectWorker} handleClearWorker={handleClearWorker}
                  selectedCompany={selectedCompany} onSelectedCompanyChange={setSelectedCompany} companies={companies}
                />
                <ItemSelection
                  scannedItem={scannedItem} itemBarcodeInput={itemBarcodeInput} onItemBarcodeInputChange={setItemBarcodeInput}
                  onScanItem={() => handleScanItem()} onStartItemScan={() => setScanningItem(true)}
                  itemSearchTerm={itemSearchTerm} onItemSearchTermChange={setItemSearchTerm}
                  onSearchItemByName={handleSearchItemByName} itemSearchResults={itemSearchResults}
                  onSelectItem={handleSelectItem} onClearItem={handleClearItem}
                  onAddItemToList={handleAddItemToList} onOpenKitDialog={() => setIsKitDialogOpen(true)}
                  quantityToChange={quantityToChange} onQuantityChange={setQuantityToChange}
                  incrementQuantity={() => setQuantityToChange(q => q + 1)} decrementQuantity={() => setQuantityToChange(q => Math.max(1, q - 1))}
                  transactionType={transactionType} isBroken={isBroken} onIsBrokenChange={setIsBroken}
                  isRecipientSelected={!!scannedWorker || !!selectedCompany}
                />
                <TransactionMeta
                  authorizedBy={authorizedBy} onAuthorizedByChange={setAuthorizedBy}
                  givenBy={givenBy} onGivenByChange={setGivenBy}
                  applicationLocation={applicationLocation} onApplicationLocationChange={setApplicationLocation}
                />
                <TransactionList items={transactionItems} onRemoveItem={handleRemoveItemFromList} />
                <div className="pt-4"><Button onClick={handleFinalizeTransactions} className="w-full" disabled={transactionItems.length === 0 || (!scannedWorker && !selectedCompany)}>{t('finalize_transactions')}</Button></div>
                <div className="pt-4 border-t"><Button onClick={handleDone} className="w-full">{t('done_with_current_transaction')}</Button></div>
                <RecentTransactions />
              </TabsContent>
              <TabsContent value="outstanding-takeouts"><OutstandingItems /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Dialog open={isKitDialogOpen} onOpenChange={setIsKitDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('select_a_kit')}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-4">
            {kits && kits.length > 0 ? (
              kits.map(kit => (
                <Button key={kit.id} variant="outline" className="w-full justify-start" onClick={() => handleSelectKit(kit.id)}>
                  {kit.name}
                </Button>
              ))
            ) : (
              <p className="text-center text-muted-foreground">{t('no_kits_available')} <Link to="/kits" className="underline">{t('create_one_now')}</Link>.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};

export default WorkerTransaction;