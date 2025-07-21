import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, Plus, Minus, ArrowLeft, Camera, Flashlight, PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';
import { Capacitor } from '@capacitor/core';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import beepSound from '/beep.mp3';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/integrations/supabase/auth'; // Import useAuth
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  image_url: string | null;
  image?: File | null;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
  one_time_use: boolean;
  user_id: string; // Added user_id
}

const initialNewItemState = {
  name: '',
  description: '',
  barcode: '',
  quantity: 0,
  image: null as File | null,
  low_stock_threshold: 10,
  critical_stock_threshold: 5,
  one_time_use: false,
};

const ScanItem = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { user } = useAuth(); // Get the current user
  const [barcode, setBarcode] = useState('');
  const [item, setItem] = useState<Item | null>(null);
  const [quantityChange, setQuantityChange] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [newItemDetails, setNewItemDetails] = useState<typeof initialNewItemState>(initialNewItemState);

  const navigate = useNavigate();

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Error playing sound:", e));
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

  useEffect(() => {
    const currentIsWeb = !Capacitor.isNativePlatform();
    setIsWeb(currentIsWeb);

    const stopAllScanners = async () => {
      if (html5QrCodeScannerRef.current) {
        await html5QrCodeScannerRef.current.stop().catch(error => {
          console.error("Failed to stop html5Qrcode: ", error);
        });
        html5QrCodeScannerRef.current = null;
      }
      try {
        if (!currentIsWeb) {
          await BarcodeScanner.stopScan();
          await BarcodeScanner.showBackground();
          if (isTorchOn) {
            await BarcodeScanner.disableTorch();
            setIsTorchOn(false);
          }
        }
      } catch (e) {
        console.error("Error stopping native barcode scanner:", e);
      } finally {
        setBodyBackground('');
        removeCssClass('barcode-scanner-active');
      }
    };

    if (scanning) {
      if (currentIsWeb) {
        const startWebScanner = async () => {
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              let cameraId = cameras[0].id;
              const backCamera = cameras.find(camera => camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment'));
              if (backCamera) {
                cameraId = backCamera.id;
              } else if (cameras.length > 1) {
                cameraId = cameras[1].id;
              }

              const readerElement = document.getElementById("reader");
              if (readerElement) {
                const html5Qrcode = new Html5Qrcode("reader");
                html5QrCodeScannerRef.current = html5Qrcode;

                await html5Qrcode.start(
                  cameraId,
                  { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
                  (decodedText) => {
                    console.log("Web scan successful:", decodedText);
                    setBarcode(decodedText);
                    fetchItemByBarcode(decodedText);
                    playBeep();
                    setScanning(false);
                  },
                  (errorMessage) => {
                    console.warn(`QR Code Scan Error: ${errorMessage}`);
                  }
                );
              } else {
                console.error("HTML Element with id=reader not found during web scan start attempt.");
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
        };
        startWebScanner();
      } else {
        const runNativeScan = async () => {
          const hasPermission = await checkPermission();
          if (!hasPermission) {
            setScanning(false);
            return;
          }
          setBodyBackground('transparent');
          addCssClass('barcode-scanner-active');
          BarcodeScanner.hideBackground();
          const result = await BarcodeScanner.startScan();
          if (result.hasContent && result.content) {
            console.log("Native scan successful:", result.content);
            setBarcode(result.content);
            await fetchItemByBarcode(result.content);
            playBeep();
            setScanning(false);
          } else {
            showError(t('no_barcode_scanned_cancelled'));
            setScanning(false);
          }
        };
        runNativeScan();
      }
    } else {
      stopAllScanners();
    }

    return () => {
      stopAllScanners();
    };
  }, [scanning, isWeb]);

  const checkPermission = async () => {
    const status = await BarcodeScanner.checkPermission({ force: true });
    if (status.granted) {
      return true;
    }
    if (status.denied) {
      showError(t('camera_permission_denied'));
    }
    return false;
  };

  const startScan = () => {
    setBarcode('');
    setItem(null);
    setQuantityChange(0);
    setScanning(true);
    setShowNewItemDialog(false);
  };

  const stopScan = () => {
    setScanning(false);
  };

  const toggleTorch = async () => {
    if (!Capacitor.isNativePlatform()) {
      showError(t('flashlight_native_only'));
      return;
    }
    try {
      if (isTorchOn) {
        await BarcodeScanner.disableTorch();
        setIsTorchOn(false);
        showSuccess(t('flashlight_off'));
      } else {
        await BarcodeScanner.enableTorch();
        setIsTorchOn(true);
        showSuccess(t('flashlight_on'));
      }
    } catch (e: any) {
      showError(t('failed_to_toggle_flashlight') + e.message);
    }
  };

  const fetchItemByBarcode = async (scannedBarcode: string) => {
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }
    console.log("Attempting to fetch item with barcode:", scannedBarcode);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', scannedBarcode)
      .eq('user_id', user.id) // Filter by user_id
      .single();

    if (error) {
      console.error("Error fetching item:", error);
      // Check if the error is specifically because no rows were found (PGRST116)
      if (error.code === 'PGRST116') {
        showError(t('item_not_found_add_new'));
        setItem(null);
        setNewItemDetails({ ...initialNewItemState, barcode: scannedBarcode });
        setShowNewItemDialog(true);
      } else {
        // For other types of errors (e.g., network, database issues), just show an error toast
        showError(t('error_fetching_item') + error.message);
        setItem(null);
        setShowNewItemDialog(false); // Ensure dialog is not shown for other errors
      }
    } else {
      console.log("Item found:", data);
      setItem(data);
      showSuccess(t('item_found', { itemName: data.name }));
      setShowNewItemDialog(false);
    }
  };

  const handleQuantityUpdate = async (type: 'add' | 'remove') => {
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
    if (type === 'add') {
      newQuantity += quantityChange;
    } else {
      if (item.quantity < quantityChange) {
        showError(t('cannot_remove_more_than_available', { available: item.quantity }));
        return;
      }
      newQuantity -= quantityChange;
    }

    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', item.id)
      .eq('user_id', user.id); // Ensure user_id is maintained/updated

    if (error) {
      showError(t('error_updating_quantity') + error.message);
    } else {
      showSuccess(t('quantity_updated_successfully', { newQuantity }));
      setItem({ ...item, quantity: newQuantity });
      setQuantityChange(0);
      setBarcode('');
    }
  };

  const handleNewItemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsedValue = name === 'quantity' || name === 'low_stock_threshold' || name === 'critical_stock_threshold' ? parseInt(value) : value;
    setNewItemDetails({ ...newItemDetails, [name]: parsedValue });
  };

  const handleNewItemToggleChange = (checked: boolean) => {
    setNewItemDetails({ ...newItemDetails, one_time_use: checked });
  };

  const handleNewItemImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewItemDetails({ ...newItemDetails, image: e.target.files[0] });
    }
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
        user_id: user.id // Set user_id
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
    setItem(null);
  };

  return (
    <React.Fragment>
      <audio ref={audioRef} src={beepSound} preload="auto" />
      <div className={`min-h-screen flex items-center justify-center p-4 ${scanning && !isWeb ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-900'}`}>
        {scanning && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
            {isWeb ? (
              <>
                <div id="reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
                <Button onClick={stopScan} className="mt-4" variant="secondary">
                  {t('cancel_scan')}
                </Button>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-black opacity-50"></div>
                <div className="relative z-10 text-white text-lg">
                  {t('scanning_for_barcode')}
                  <Button onClick={stopScan} className="mt-4 block mx-auto" variant="secondary">
                    {t('cancel_scan')}
                  </Button>
                  <Button onClick={toggleTorch} className="mt-2 block mx-auto" variant="outline">
                    <Flashlight className={`mr-2 h-4 w-4 ${isTorchOn ? 'text-yellow-400' : ''}`} />
                    {isTorchOn ? t('turn_flashlight_off') : t('turn_flashlight_on')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

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
              <div className="w-10"></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder={t('enter_barcode_manually')}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="flex-grow"
              />
              <Button onClick={startScan}>
                <Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}
              </Button>
            </div>
            {barcode && !item && !showNewItemDialog && (
              <Button onClick={() => fetchItemByBarcode(barcode)} className="w-full">
                <Barcode className="mr-2 h-4 w-4" /> {t('search_item_by_barcode')}
              </Button>
            )}

            {item && (
              <div className="border p-4 rounded-md space-y-2">
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p><strong>{t('description')}:</strong> {item.description || 'N/A'}</p>
                <p><strong>{t('current_quantity')}:</strong> {item.quantity}</p>
                <p><strong>{t('barcode')}:</strong> {item.barcode}</p>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="quantityChange">{t('change_quantity_by')}</Label>
                  <Input
                    id="quantityChange"
                    type="number"
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleQuantityUpdate('add')} className="flex-1">
                      <Plus className="mr-2 h-4 w-4" /> {t('add')}
                    </Button>
                    <Button onClick={() => handleQuantityUpdate('remove')} variant="destructive" className="flex-1">
                      <Minus className="mr-2 h-4 w-4" /> {t('remove')}
                    </Button>
                  </div>
                </div>
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