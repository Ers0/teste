import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { ArrowLeft, Package, Users, Plus, Minus, Search, Trash2, Send } from 'lucide-react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Item, Worker } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Outbox } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface RequisitionItem {
  item: Item;
  quantity: number;
}

const CreateRequisition = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [workerSearchResults, setWorkerSearchResults] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');
  const [selectionMode, setSelectionMode] = useState<'worker' | 'company'>('worker');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>([]);
  const navigate: NavigateFunction = useNavigate();

  const allWorkers = useLiveQuery(() => db.workers.toArray(), []);
  const requisitionableItems = useLiveQuery(() => db.items.where('requires_requisition').equals('true').toArray(), []);

  const companies = useMemo(() => {
    if (!allWorkers) return [];
    const uniqueCompanies = [...new Set(allWorkers.map(w => w.company).filter(Boolean))] as string[];
    return uniqueCompanies.sort();
  }, [allWorkers]);

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
    setSelectedWorker(worker);
    setWorkerSearchTerm(worker.name);
    setWorkerSearchResults([]);
    showSuccess(t('worker_selected', { workerName: worker.name }));
  };

  const handleClearWorker = () => {
    if (requisitionItems.length > 0) {
      if (window.confirm(t('confirm_clear_worker_with_items'))) {
        setRequisitionItems([]);
      } else {
        return;
      }
    }
    setSelectedWorker(null);
    setWorkerSearchTerm('');
    setWorkerSearchResults([]);
    setSelectedCompany(null);
    showSuccess(t('selection_cleared'));
  };

  const handleSearchItemByName = () => {
    if (!itemSearchTerm.trim()) { showError(t('enter_item_name_to_search')); return; }
    const results = requisitionableItems?.filter(i => i.name.toLowerCase().includes(itemSearchTerm.trim().toLowerCase())) || [];
    if (results.length > 0) {
      setItemSearchResults(results);
      if (results.length === 1) {
        handleSelectItem(results[0]);
      } else {
        showSuccess(t('multiple_items_found_select'));
      }
    } else {
      showError(t('no_items_found_for_name'));
      setItemSearchResults([]);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemSearchTerm(item.name);
    setItemSearchResults([]);
    showSuccess(t('item_selected', { itemName: item.name }));
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { showError(t('select_item_first')); return; }
    if (quantity <= 0) { showError(t('quantity_greater_than_zero')); return; }

    setRequisitionItems(prev => [...prev, { item: selectedItem, quantity }]);
    showSuccess(t('item_added_to_requisition', { itemName: selectedItem.name }));

    setSelectedItem(null);
    setItemSearchTerm('');
    setItemSearchResults([]);
    setQuantity(1);
  };

  const handleRemoveItemFromList = (indexToRemove: number) => {
    setRequisitionItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmitRequisition = async () => {
    if (requisitionItems.length === 0) { showError(t('no_items_in_requisition_list')); return; }
    if (selectionMode === 'worker' && !selectedWorker) { showError(t('select_worker_first')); return; }
    if (selectionMode === 'company' && !selectedCompany) { showError(t('select_company_first')); return; }
    if (!user) { showError(t('user_not_authenticated_login')); return; }

    const toastId = showLoading(t('submitting_requisition'));

    try {
      const getNextRequisitionNumber = (): string => {
        const key = 'lastRequisitionNumber';
        let lastNumber = parseInt(localStorage.getItem(key) || '0', 10);
        const newNumber = lastNumber + 1;
        localStorage.setItem(key, newNumber.toString());
        return newNumber.toString().padStart(4, '0');
      };

      const newRequisition = {
        id: uuidv4(),
        requisition_number: getNextRequisitionNumber(),
        user_id: user.id,
        authorized_by: authorizedBy.trim() || null,
        given_by: givenBy.trim() || null,
        requester_name: selectionMode === 'worker' ? selectedWorker!.name : selectedCompany,
        requester_company: selectionMode === 'worker' ? selectedWorker!.company : selectedCompany,
        application_location: applicationLocation.trim() || null,
        created_at: new Date().toISOString(),
        status: 'pending',
      };

      const newRequisitionItems = requisitionItems.map(item => ({
        id: uuidv4(),
        requisition_id: newRequisition.id,
        item_id: item.item.id,
        quantity: item.quantity,
        user_id: user.id,
        created_at: new Date().toISOString(),
      }));

      const outboxOps: Outbox[] = [
        { type: 'create', table: 'requisitions', payload: newRequisition, timestamp: Date.now() },
        ...newRequisitionItems.map(item => ({ type: 'create', table: 'requisition_items', payload: item, timestamp: Date.now() }))
      ];

      await db.transaction('rw', db.requisitions, db.requisition_items, db.outbox, async () => {
        await db.requisitions.add(newRequisition);
        await db.requisition_items.bulkAdd(newRequisitionItems);
        await db.outbox.bulkAdd(outboxOps as any);
      });

      dismissToast(toastId);
      showSuccess(t('requisition_submitted_successfully'));
      navigate('/requisitions');

    } catch (error: any) {
      dismissToast(toastId);
      showError(t('error_submitting_requisition') + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-2xl">{t('create_requisition')}</CardTitle>
              <CardDescription>{t('create_requisition_description')}</CardDescription>
            </div>
            <div className="w-10" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold flex items-center"><Users className="mr-2 h-5 w-5" /> {t('recipient')}</h3>
            <ToggleGroup type="single" value={selectionMode} onValueChange={(value: 'worker' | 'company') => { if (value) { setSelectionMode(value); handleClearWorker(); } }} className="grid grid-cols-2 gap-2">
              <ToggleGroupItem value="worker">{t('worker')}</ToggleGroupItem>
              <ToggleGroupItem value="company">{t('company')}</ToggleGroupItem>
            </ToggleGroup>

            {selectionMode === 'worker' && !selectedWorker && (
              <>
                <div className="flex items-center space-x-2">
                  <Input type="text" placeholder={t('enter_worker_name_to_search')} value={workerSearchTerm} onChange={(e) => setWorkerSearchTerm(e.target.value)} className="flex-grow" />
                  <Button onClick={handleSearchWorkerByName}><Search className="mr-2 h-4 w-4" /> {t('search')}</Button>
                </div>
                {workerSearchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {workerSearchResults.map((worker) => (
                      <Button key={worker.id} variant="outline" className="w-full justify-start" onClick={() => handleSelectWorker(worker)}>
                        {worker.name} ({worker.company || t('no_company')})
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
            {selectionMode === 'worker' && selectedWorker && (
              <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                <p><strong>{t('name')}:</strong> {selectedWorker.name}</p>
                <p><strong>{t('company')}:</strong> {selectedWorker.company || 'N/A'}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={handleClearWorker}>{t('change_worker')}</Button>
              </div>
            )}
            {selectionMode === 'company' && (
              <div className="space-y-2">
                <Label htmlFor="company-select">{t('select_company')}</Label>
                <Select onValueChange={setSelectedCompany} value={selectedCompany || ''}>
                  <SelectTrigger id="company-select"><SelectValue placeholder={t('select_a_company')} /></SelectTrigger>
                  <SelectContent>{companies?.map(company => (<SelectItem key={company} value={company}>{company}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold flex items-center"><Package className="mr-2 h-5 w-5" /> {t('item_information')}</h3>
            <p className="text-xs text-muted-foreground">{t('only_requisition_items_shown')}</p>
            <div className="flex items-center space-x-2">
              <Input type="text" placeholder={t('enter_item_name_to_search')} value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} className="flex-grow" />
              <Button onClick={handleSearchItemByName}><Search className="mr-2 h-4 w-4" /> {t('search')}</Button>
            </div>
            {itemSearchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {itemSearchResults.map((item) => (
                  <Button key={item.id} variant="outline" className="w-full justify-start" onClick={() => handleSelectItem(item)}>
                    {item.name}
                  </Button>
                ))}
              </div>
            )}
            {selectedItem && (
              <div className="border p-3 rounded-md space-y-2 bg-gray-50 dark:bg-gray-800">
                <h4 className="text-md font-semibold">{selectedItem.name}</h4>
                <p><strong>{t('current_quantity')}:</strong> {selectedItem.quantity}</p>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="quantity">{t('quantity_to_request')}</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}><Minus className="h-4 w-4" /></Button>
                    <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} min="1" className="text-center" />
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Button onClick={handleAddItemToList} className="w-full mt-2">{t('add_to_requisition')}</Button>
              </div>
            )}
          </div>

          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{t('requisition_details')}</h3>
            <div className="space-y-2"><Label htmlFor="authorizedBy">{t('authorized_by')}</Label><Input id="authorizedBy" type="text" placeholder={t('enter_authorizer_name')} value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="givenBy">{t('given_by')}</Label><Input id="givenBy" type="text" placeholder={t('enter_giver_name')} value={givenBy} onChange={(e) => setGivenBy(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="applicationLocation">{t('application_location')}</Label><Input id="applicationLocation" type="text" placeholder={t('enter_application_location')} value={applicationLocation} onChange={(e) => setApplicationLocation(e.target.value)} /></div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('items_to_request')}</h3>
            {requisitionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('no_items_added_yet')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {requisitionItems.map((reqItem, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                    <div><p className="font-medium">{reqItem.item.name}</p><p className="text-sm text-muted-foreground">{t('quantity')}: {reqItem.quantity}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItemFromList(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button onClick={handleSubmitRequisition} className="w-full" disabled={requisitionItems.length === 0 || (!selectedWorker && !selectedCompany)}>
              <Send className="mr-2 h-4 w-4" /> {t('submit_requisition')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateRequisition;