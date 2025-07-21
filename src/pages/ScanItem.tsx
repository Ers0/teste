import React, { useState, useEffect, useRef } from 'react';
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
import { Capacitor } from '@capacitor/core'; // Import Capacitor to check platform
import { Html5QrcodeScanner } from 'html5-qrcode'; // Import html5-qrcode

const ScanItem = () => {
  const [barcode, setBarcode] = useState('');
  const [item, setItem] = useState<any>(null);
  const [quantityChange, setQuantityChange] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [isWeb, setIsWeb] = useState(false); // State to track if running on web
  const html5QrCodeScannerRef = useRef<Html5QrcodeScanner | null>(null); // Ref for web scanner instance
  const navigate = useNavigate();

  // Determine platform and manage scanner lifecycle
  useEffect(() => {
    const currentIsWeb = !Capacitor.isNativePlatform();
    setIsWeb(currentIsWeb);

    const stopAllScanners = async () => {
      if (html5QrCodeScannerRef.current) {
        await html5QrCodeScannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner: ", error);
        });
        html5QrCodeScannerRef.current = null;
      }
      try {
        if (!currentIsWeb) { // Only stop native scanner if it was active
          await BarcodeScanner.stopScan();
          await BarcodeScanner.showBackground();
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
        // Web scanning logic using html5-qrcode
        const startWebScanner = async () => {
          try {
            const readerElement = document.getElementById("reader");
            if (readerElement) {
              const html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
                /* verbose= */ false
              );
              html5QrcodeScannerRef.current = html5QrcodeScanner;

              html5QrcodeScanner.render(
                (decodedText) => {
                  setBarcode(decodedText);
                  fetchItemByBarcode(decodedText);
                  setScanning(false); // Stop scanning after successful scan
                },
                (errorMessage) => {
                  // console.warn(`QR Code Scan Error: ${errorMessage}`);
                }
              );
            } else {
              console.error("HTML Element with id=reader not found during web scan start attempt.");
              setScanning(false);
            }
          } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            showError('Error starting web camera scan: ' + errorMessage);
            setScanning(false);
          }
        };
        startWebScanner();
      } else {
        // Native scanning logic
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
            setBarcode(result.content);
            await fetchItemByBarcode(result.content);
            setScanning(false); // Stop scanning after successful scan
          } else {
            showError('No barcode scanned or scan cancelled.');
            setScanning(false);
          }
        };
        runNativeScan();
      }
    } else {
      // If scanning is false, ensure all scanners are stopped
      stopAllScanners();
    }

    // Cleanup function for the effect (runs on unmount or when dependencies change and effect re-runs)
    return () => {
      stopAllScanners();
    };
  }, [scanning, isWeb]); // Dependencies: scanning and isWeb

  const checkPermission = async () => {
    const status = await BarcodeScanner.checkPermission({ force: true });
    if (status.granted) {
      return true;
    }
    if (status.denied) {
      showError('Camera permission denied. Please enable it in your app settings.');
    }
    return false;
  };

  const startScan = () => {
    setBarcode('');
    setItem(null);
    setQuantityChange(0);
    setScanning(true); // This will trigger the useEffect to start the appropriate scanner
  };

  const stopScan = () => {
    setScanning(false); // This will trigger the useEffect cleanup to stop scanners
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
    <React.Fragment>
      <div className={`min-h-screen flex items-center justify-center p-4 ${scanning && !isWeb ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-900'}`}>
        {scanning && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
            {isWeb ? (
              <>
                <div id="reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
                <Button onClick={stopScan} className="mt-4" variant="secondary">
                  Cancel Scan
                </Button>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-black opacity-50"></div>
                <div className="relative z-10 text-white text-lg">
                  Scanning for barcode...
                  <Button onClick={stopScan} className="mt-4 block mx-auto" variant="secondary">
                    Cancel Scan
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
    </React.Fragment>
  );
};

export default ScanItem;