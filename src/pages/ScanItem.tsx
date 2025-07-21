import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, Plus, Minus, ArrowLeft, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';

const ScanItem = () => {
  const [barcode, setBarcode] = useState('');
  const [item, setItem] = useState<any>(null);
  const [quantityChange, setQuantityChange] = useState(0);
  const [scanning, setScanning] = useState(false); // New state for scanning status
  const navigate = useNavigate();

  useEffect(() => {
    // Cleanup function to stop scanning and reset body background when component unmounts
    return () => {
      stopScan();
    };
  }, []);

  const checkPermission = async () => {
    // check or request permission
    const status = await BarcodeScanner.checkPermission({ force: true });

    if (status.granted) {
      return true;
    }

    if (status.denied) {
      showError('Camera permission denied. Please enable it in your app settings.');
    }

    return false;
  };

  const startScan = async () => {
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      return;
    }

    setBarcode(''); // Clear previous barcode
    setItem(null); // Clear previous item
    setQuantityChange(0); // Reset quantity change

    setScanning(true);
    setBodyBackground('transparent'); // Make body transparent for camera feed
    addCssClass('barcode-scanner-active'); // Add class to body for styling

    BarcodeScanner.hideBackground(); // make background of WebView transparent

    const result = await BarcodeScanner.startScan(); // start scanning and wait for a result

    if (result.hasResult && result.barcode) {
      setBarcode(result.barcode.displayValue);
      await fetchItemByBarcode(result.barcode.displayValue);
      stopScan();
    } else {
      showError('No barcode scanned or scan cancelled.');
      stopScan();
    }
  };

  const stopScan = () => {
    BarcodeScanner.stopScan();
    setScanning(false);
    setBodyBackground(''); // Reset body background
    removeCssClass('barcode-scanner-active'); // Remove class from body
  };

  const fetchItemByBarcode = async (scannedBarcode: string) => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', scannedBarcode)
      .single();

    if (error) {
      showError('Item not found or error fetching item: ' + error.message);
      setItem(null);
    } else {
      setItem(data);
      showSuccess(`Item "${data.name}" found!`);
    }
  };

  const handleQuantityUpdate = async (type: 'add' | 'remove') => {
    if (!item) {
      showError('No item selected to update.');
      return;
    }
    if (quantityChange <= 0) {
      showError('Quantity change must be greater than zero.');
      return;
    }

    let newQuantity = item.quantity;
    if (type === 'add') {
      newQuantity += quantityChange;
    } else {
      if (item.quantity < quantityChange) {
        showError('Cannot remove more items than available quantity.');
        return;
      }
      newQuantity -= quantityChange;
    }

    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', item.id);

    if (error) {
      showError('Error updating quantity: ' + error.message);
    } else {
      showSuccess(`Quantity updated successfully! New quantity: ${newQuantity}`);
      setItem({ ...item, quantity: newQuantity });
      setQuantityChange(0);
      setBarcode(''); // Clear barcode after successful update
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${scanning ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-900'}`}>
      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <div className="relative z-10 text-white text-lg">
            Scanning for barcode...
            <Button onClick={stopScan} className="mt-4 block mx-auto" variant="secondary">
              Cancel Scan
            </Button>
          </div>
        </div>
      )}

      <Card className={`w-full max-w-md ${scanning ? 'hidden' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-2xl">Scan Item</CardTitle>
              <CardDescription>Scan an item to add or remove quantity.</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Enter barcode manually"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={startScan}>
              <Camera className="mr-2 h-4 w-4" /> Scan with Camera
            </Button>
          </div>
          {barcode && !item && (
            <Button onClick={() => fetchItemByBarcode(barcode)} className="w-full">
              <Barcode className="mr-2 h-4 w-4" /> Search Item by Barcode
            </Button>
          )}

          {item && (
            <div className="border p-4 rounded-md space-y-2">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p><strong>Description:</strong> {item.description || 'N/A'}</p>
              <p><strong>Current Quantity:</strong> {item.quantity}</p>
              <p><strong>Barcode:</strong> {item.barcode}</p>

              <div className="space-y-2 mt-4">
                <Label htmlFor="quantityChange">Change Quantity By:</Label>
                <Input
                  id="quantityChange"
                  type="number"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(parseInt(e.target.value) || 0)}
                  min="0"
                />
                <div className="flex gap-2">
                  <Button onClick={() => handleQuantityUpdate('add')} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" /> Add
                  </Button>
                  <Button onClick={() => handleQuantityUpdate('remove')} variant="destructive" className="flex-1">
                    <Minus className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanItem;