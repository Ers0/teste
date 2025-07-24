import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, Plus, Minus, ArrowLeft, Camera, PlusCircle, Search, Focus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { db } from '@/lib/db';
import { Item } from '@/types';

const initialNewItemState = {
  name: '',
  description: '',
  barcode: '',
  quantity: 0,
  image: null as File | null,
  low_stock_threshold: 10,
  critical_stock_threshold: 5,
  one_time_use: false,
  is_tool: false,
  tags: '',
};

const ScanItem = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [item, setItem] = useState<Item | null>(null);
  const [quantityChange, setQuantityChange] = useState(1);
  const [transactionMode, setTransactionMode] = useState<'restock' | 'takeout'>('restock');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [scanning, setScanning] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const navigate: NavigateFunction = useNavigate();

  const startWebScanner = useCallback(async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        let cameraId = cameras[0].id;
        const backCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('environment')
        );
        if (backCamera) {
          cameraId = backCamera.id;
        } else if (cameras.length > 1) {
          cameraId = cameras[1].id;
        }

        const readerElementId = "reader";
        const readerElement = document.getElementById(readerElementId);
        if (readerElement) {
          setTimeout(async () => {
            if (html5QrCodeScannerRef.current) {
              await html5QrCodeScannerRef.current.stop().catch(() => {});
              html5QrCodeScannerRef.current.clear();
              html5QrCodeScannerRef.current = null;
            }
            try {
              const html5Qrcode = new Html5Qrcode(readerElementId);
              html5QrCodeScannerRef.current = html5Qrcode;

              await html5Qrcode.start(
                cameraId,
                { fps: 10, qrbox: { width: 300, height: 150 }, disableFlip: false },
                (decodedText) => {
                  console.log("Web scan successful:", decodedText);
                  setBarcode(decodedText);
                  fetchItemByBarcode(decodedText);
                  setScanning(false);
                },
                () => {}
              );
            } catch (err: any) {
              console.error(`Failed to start camera ${cameraId}:`, err);
              showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
              setScanning(false);
            }
          }, 200);
        } else {
          showError(t('camera_display_area_not_found'));
          setScanning(false);
        }
      } else {
        showError(t('no_camera_found_access_denied'));
        setScanning(false);
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      showError(t('error_starting_web_camera_scan') + errorMessage + t('check_camera_permissions'));
      setScanning(false);
    }
  }, [t]);

  useEffect(() => {
    const stopWebScanner = async () => {
      if (html5QrCodeScannerRef.current) {
        try {
          await html5QrCodeScannerRef.current.stop();
          html5QrCodeScannerRef.current.clear();
        } catch (error) {
          console.error("Failed to stop or clear html5Qrcode: ", error);
        } finally {
          html5QrCodeScannerRef.current = null;
        }
      }
    };

    if (scanning) {
      startWebScanner();
    } else {
      stopWebScanner();
    }

    return () => {
      stopWebScanner();
    };
  }, [scanning, startWebScanner]);

  const handleRefocus = async () => {
    if (html5QrCodeScannerRef.current) {
      try {
        await html5QrCodeScannerRef.current.stop();
        html5QrCodeScannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping for refocus:", error);
      } finally {
        html5QrCodeScannerRef.current = null;
      }
    }
    setTimeout(startWebScanner, 100);
  };

  const startScan = () => {
    setBarcode('');
    setItem(null);
    setQuantityChange(1);
    setTransactionMode('restock');
    setAuthorizedBy('');
    setGivenBy('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setScanning(true);
    setShowNewItemDialog(false);
  };

  const stopScan = () => {
    setScanning(false);
  };

  const fetchItemByBarcode = async (scannedBarcode: string) => {
    console.log("Attempting to fetch item with barcode from local DB:", scannedBarcode);
    const item = await db.items.where('barcode').equals(scannedBarcode).first();

    if (item) {
      console.log("Item found:", item);
      setItem(item);
      showSuccess(t('item_found', { itemName: item.name }));
      setTransactionMode('restock');
      setQuantityChange(1);
      setShowNewItemDialog(false);
      setItemSearchTerm('');
      setItemSearchResults([]);
    } else {
      console.error("Item not found in local DB");
      showError(t('item_not_found_add_new'));
      setItem(null);
      setNewItemDetails({ ...initialNewItemState, barcode: scannedBarcode });
      setShowNewItemDialog(true);
    }
  };

  const handleSearchItemByName = async () => {
    if (!itemSearchTerm.trim()) {
      showError(t('enter_item_name_to_search'));
      return;
    }

    const searchLower = itemSearchTerm.trim().toLowerCase();
    
    try {
      const allItems = await db.items.toArray();
      const allTags = await db.tags.toArray();

      const matchingTagIds = allTags
        .filter(tag => tag.name.toLowerCase().includes(searchLower))
        .map(tag => tag.id);

      const results = allItems.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(searchLower);
        const tagMatch = item.tags?.some(tagId => matchingTagIds.includes(tagId)) ?? false;
        return nameMatch || tagMatch;
      });

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
    } catch (error) {
      console.error("Error searching items locally:", error);
      showError(t('error_searching_items_locally'));
    }
  };

  const handleSelectItem = (selectedItem: Item) => {
    setItem(selectedItem);
    setBarcode(selectedItem.barcode || '');
    setItemSearchTerm(selectedItem.name);
    setItemSearchResults([]);
    showSuccess(t('item_selected', { itemName: selectedItem.name }));
    if (selectedItem.one_time_use) {
      setTransactionMode('takeout');
      showError(t('this_is_one_time_use_item_takeout_only'));
    }
  };

  const handleClearItem = () => {
    setItem(null);
    setBarcode('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setQuantityChange(1);
    setTransactionMode('restock');
    setAuthorizedBy('');
    setGivenBy('');
    showSuccess(t('item_selection_cleared'));
  };

  const handleRecordTransaction = async () => {
    if (!item) {
      showError(t('no_item_selected_update'));
      return;
    }
    if (quantityChange <= 0) {
      showError(t('quantity_change_greater_than_zero'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let newQuantity = item.quantity;
    if (transactionMode === 'restock') {
      newQuantity += quantityChange;
    } else {
      if (item.quantity < quantityChange) {
        showError(t('cannot_remove_more_than_available', { available: item.quantity }));
        return;
      }
      newQuantity -= quantityChange;
    }

    const { error: updateError } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', item.id)
      .eq('user_id', user.id);

    if (updateError) {
      showError(t('error_updating_item_quantity') + updateError.message);
      return;
    }

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          item_id: item.id,
          worker_id: null,
          type: transactionMode,
          quantity: quantityChange,
          user_id: user.id,
          authorized_by: authorizedBy.trim() || null,
          given_by: givenBy.trim() || null,
        },
      ]);

    if (transactionError) {
      showError(t('error_recording_transaction') + transactionError.message);
      await supabase.from('items').update({ quantity: item.quantity }).eq('id', item.id).eq('user_id', user.id);
      return;
    }

    showSuccess(t('recorded_transaction_success_general', { quantity: quantityChange, itemName: item.name, type: t(transactionMode) }));
    setItem({ ...item, quantity: newQuantity });
    setQuantityChange(1);
    setBarcode('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setAuthorizedBy('');
    setGivenBy('');
  };

  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [newItemDetails, setNewItemDetails] = useState(initialNewItemState);

  const handleNewItemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsedValue = name === 'quantity' || name === 'low_stock_threshold' || name === 'critical_stock_threshold' ? parseInt(value) : value;
    setNewItemDetails({ ...newItemDetails, [name]: parsedValue });
  };

  const handleNewItemToggleChange = (checked: boolean) => {
    setNewItemDetails({ ...newItemDetails, one_time_use: checked, is_tool: checked ? false : newItemDetails.is_tool });
  };

  const handleNewItemIsToolToggleChange = (checked: boolean) => {
    setNewItemDetails({ ...newItemDetails, is_tool: checked, one_time_use: checked ? false : newItemDetails.one_time_use });
  };

  const handleNewItemImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewItemDetails({ ...newItemDetails, image: e.target.files[0] });
    }
  };

  const uploadImage = async (file: File | null, itemId: string) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${itemId}.${fileExt}`;
    const filePath = `item_images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('inventory-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      showError(t('error_uploading_image') + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddNewItem = async () => {
    if (!newItemDetails.name || newItemDetails.quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data: insertedItem, error: insertError } = await supabase
      .from('items')
      .insert([{
        name: newItemDetails.name,
        description: newItemDetails.description,
        barcode: newItemDetails.barcode,
        quantity: newItemDetails.quantity,
        low_stock_threshold: newItemDetails.low_stock_threshold,
        critical_stock_threshold: newItemDetails.critical_stock_threshold,
        one_time_use: newItemDetails.one_time_use,
        is_tool: newItemDetails.is_tool,
        user_id: user.id
      }])
      .select()
      .single();

    if (insertError) {
      showError(t('error_adding_item') + insertError.message);
      return;
    }

    let imageUrl = null;
    if (newItemDetails.image && insertedItem) {
      imageUrl = await uploadImage(newItemDetails.image, insertedItem.id);
      if (imageUrl) {
        await supabase.from('items').update({ image_url: imageUrl }).eq('id', insertedItem.id);
      }
    }

    showSuccess(t('new_item_added_successfully'));
    setNewItemDetails(initialNewItemState);
    setShowNewItemDialog(false);
    setBarcode('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setItem(null);
  };

  const incrementQuantity = () => {
    setQuantityChange(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantityChange(prev => Math.max(1, prev - 1));
  };

  return (
    <React.Fragment>
      <div className={`min-h-screen flex items-center justify-center p-4 ${scanning ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-900'}`}>
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${scanning ? '' : 'hidden'}`}>
          <div id="reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
          <div className="mt-4 flex gap-2">
            <Button onClick={stopScan} variant="secondary">
              {t('cancel_scan')}
            </Button>
            <Button onClick={handleRefocus} variant="outline">
              <Focus className="mr-2 h-4 w-4" /> {t('refocus')}
            </Button>
          </div>
        </div>

        <Card className={`w-full max-w-md ${scanning ? 'hidden' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-2xl">{t('scan_item')}</CardTitle>
                <CardDescription>{t('scan_item_add_remove_description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!item ? (
              <>
                <div className="space-y-4 border-b pb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Barcode className="mr-2 h-5 w-5" /> {t('scan_by_barcode')}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      placeholder={t('enter_item_barcode_manually')}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="flex-grow"
                    />
                    <Button onClick={startScan}>
                      <Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}
                    </Button>
                  </div>
                  {barcode && (
                    <Button onClick={() => fetchItemByBarcode(barcode)} className="w-full">
                      <Barcode className="mr-2 h-4 w-4" /> {t('search_item_by_barcode')}
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Search className="mr-2 h-5 w-5" /> {t('search_by_name')}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      placeholder={t('enter_item_name_to_search')}
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="flex-grow"
                    />
                    <Button onClick={handleSearchItemByName}>
                      <Search className="mr-2 h-4 w-4" /> {t('search_item_by_name')}
                    </Button>
                  </div>
                  {itemSearchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                      <p className="text-sm font-medium">{t('select_item_from_results')}:</p>
                      {itemSearchResults.map((resultItem) => (
                        <Tooltip key={resultItem.id}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => handleSelectItem(resultItem)}
                            >
                              {resultItem.name} ({resultItem.barcode || t('no_barcode')})
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{resultItem.description || t('no_description')}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="border p-4 rounded-md space-y-2">
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p><strong>{t('description')}:</strong> {item.description || 'N/A'}</p>
                <p><strong>{t('current_quantity')}:</strong> {item.quantity}</p>
                <p><strong>{t('barcode')}:</strong> {item.barcode}</p>
                {item.one_time_use && (
                  <p className="text-sm text-red-500 font-semibold">{t('this_is_one_time_use_item')}</p>
                )}

                <div className="space-y-2 mt-4">
                  <Label htmlFor="transactionMode">{t('transaction_type')}:</Label>
                  <ToggleGroup
                    type="single"
                    value={transactionMode}
                    onValueChange={(value: 'restock' | 'takeout') => {
                      if (item.one_time_use && value === 'restock') {
                        showError(t('cannot_restock_one_time_use'));
                        return;
                      }
                      value && setTransactionMode(value);
                    }}
                    className="flex justify-center gap-4"
                  >
                    <ToggleGroupItem
                      value="restock"
                      aria-label="Toggle restock"
                      disabled={item.one_time_use}
                      className="flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:dark:bg-green-900 data-[state=on]:dark:text-green-200"
                    >
                      {t('restock')}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="takeout"
                      aria-label="Toggle takeout"
                      className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:dark:bg-red-900 data-[state=on]:dark:text-red-200"
                    >
                      {t('takeout')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="quantityChange">{t('quantity_to_change', { type: t(transactionMode) })}</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantityChange <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    {/* @ts-ignore */}
                    <Input
                      id="quantityChange"
                      type="number"
                      value={quantityChange}
                      onChange={(e) => setQuantityChange(parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-center"
                    />
                    <Button variant="outline" size="icon" onClick={incrementQuantity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authorizedBy">{t('authorized_by')}</Label>
                  <Input
                    id="authorizedBy"
                    type="text"
                    placeholder={t('enter_authorizer_name')}
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="givenBy">{t('given_by')}</Label>
                  <Input
                    id="givenBy"
                    type="text"
                    placeholder={t('enter_giver_name')}
                    value={givenBy}
                    onChange={(e) => setGivenBy(e.target.value)}
                  />
                </div>

                <Button onClick={handleRecordTransaction} className="w-full">
                  {t('record')} {t(transactionMode)}
                </Button>
                <Button variant="outline" onClick={handleClearItem} className="w-full mt-2">
                  {t('clear_item_selection')}
                </Button>
              </div>
            )}

            <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t('add_new_item')}</DialogTitle>
                  <DialogDescription>
                    {t('no_existing_item_found')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemName" className="text-right">
                      {t('name')}
                    </Label>
                    <Input
                      id="newItemName"
                      name="name"
                      value={newItemDetails.name}
                      onChange={handleNewItemInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemDescription" className="text-right">
                      {t('description')}
                    </Label>
                    <Input
                      id="newItemDescription"
                      name="description"
                      value={newItemDetails.description}
                      onChange={handleNewItemInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemBarcode" className="text-right">
                      {t('barcode')}
                    </Label>
                    <Input
                      id="newItemBarcode"
                      name="barcode"
                      value={newItemDetails.barcode}
                      readOnly
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemQuantity" className="text-right">
                      {t('quantity')}
                    </Label>
                    {/* @ts-ignore */}
                    <Input
                      id="newItemQuantity"
                      name="quantity"
                      type="number"
                      value={newItemDetails.quantity}
                      onChange={handleNewItemInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemLowStockThreshold" className="text-right">
                      {t('low_stock_yellow')}
                    </Label>
                    {/* @ts-ignore */}
                    <Input
                      id="newItemLowStockThreshold"
                      name="low_stock_threshold"
                      type="number"
                      value={newItemDetails.low_stock_threshold}
                      onChange={handleNewItemInputChange}
                      className="col-span-3"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemCriticalStockThreshold" className="text-right">
                      {t('critical_stock_red')}
                    </Label>
                    {/* @ts-ignore */}
                    <Input
                      id="newItemCriticalStockThreshold"
                      name="critical_stock_threshold"
                      type="number"
                      value={newItemDetails.critical_stock_threshold}
                      onChange={handleNewItemInputChange}
                      className="col-span-3"
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemOneTimeUse" className="text-right">
                      {t('one_time_use')}
                    </Label>
                    <Switch
                      id="newItemOneTimeUse"
                      checked={newItemDetails.one_time_use}
                      onCheckedChange={handleNewItemToggleChange}
                      disabled={newItemDetails.is_tool}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemIsTool" className="text-right">
                      {t('tool')}
                    </Label>
                    <Switch
                      id="newItemIsTool"
                      checked={newItemDetails.is_tool}
                      onCheckedChange={handleNewItemIsToolToggleChange}
                      disabled={newItemDetails.one_time_use}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newItemImage" className="text-right">
                      {t('image')}
                    </Label>
                    <Input
                      id="newItemImage"
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handleNewItemImageChange}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewItemDialog(false)}>{t('cancel')}</Button>
                  <Button onClick={handleAddNewItem}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_item')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </React.Fragment>
  );
};

export default ScanItem;