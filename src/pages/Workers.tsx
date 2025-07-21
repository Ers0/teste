import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, QrCode, Download, ArrowLeft, RefreshCw, Camera, Flashlight, ClipboardList } from 'lucide-react'; // Added ClipboardList icon
import { useNavigate, Link } from 'react-router-dom'; // Import Link
import QRCode from 'qrcode';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner'; // Import for native scanning
import { Capacitor } from '@capacitor/core'; // Import Capacitor for platform detection
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'; // Import for web scanning
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils'; // Import camera utility functions
import beepSound from '/beep.mp3'; // Import beep sound

// Define a UUID type for clarity and to satisfy strict type checking
type UUID = `${string}-${string}-${string}-${string}-${string}`;

interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: UUID | null; // Use the UUID type here
  photo?: File | null; // Added for temporary file storage
  user_id: string;
}

const Workers = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newWorker, setNewWorker] = useState({ name: '', company: '', photo: null as File | null, qr_code_data: crypto.randomUUID() as UUID });
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  // State for QR scanning within the dialog
  const [scanningQr, setScanningQr] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentQrCodeData = editingWorker ? editingWorker.qr_code_data : newWorker.qr_code_data;

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Error playing sound:", e));
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkers();
    }
  }, [user]);

  // Effect to draw QR code on canvas when currentQrCodeData changes
  useEffect(() => {
    if (qrCodeRef.current && currentQrCodeData) {
      QRCode.toCanvas(qrCodeRef.current, currentQrCodeData, { scale: 4 }, function (error) {
        if (error) console.error(error);
      });
    }
  }, [qrCodeRef.current, currentQrCodeData]); // Added qrCodeRef.current to dependencies

  // Effect for QR scanning
  useEffect(() => {
    const currentIsWeb = !Capacitor.isNativePlatform();
    setIsWeb(currentIsWeb);

    const stopAllScanners = async () => {
      console.log("Stopping all scanners...");
      if (html5QrCodeScannerRef.current) {
        try {
          await html5QrCodeScannerRef.current.stop();
          console.log("Html5Qrcode stopped.");
        } catch (error) {
          console.error("Failed to stop html5Qrcode: ", error);
        } finally {
          html5QrCodeScannerRef.current = null;
        }
      }
      try {
        if (!currentIsWeb) {
          await BarcodeScanner.stopScan();
          console.log("Native BarcodeScanner stopped.");
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
        console.log("Scanner cleanup complete.");
      }
    };

    if (scanningQr) {
      console.log("Starting QR scan...");
      if (currentIsWeb) {
        const startWebScanner = async () => {
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              console.log("Cameras found:", cameras);
              let cameraId = cameras[0].id;
              const backCamera = cameras.find(camera => camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment'));
              if (backCamera) {
                cameraId = backCamera.id;
                console.log("Using back camera:", backCamera.label);
              } else if (cameras.length > 1) {
                cameraId = cameras[1].id;
              }

              const readerElement = document.getElementById("worker-qr-scanner-reader");
              if (readerElement) {
                console.log("Found worker-qr-scanner-reader element.");
                // No setTimeout needed here, as the element is now guaranteed to be in DOM when scanningQr is true
                const html5Qrcode = new Html5Qrcode("worker-qr-scanner-reader");
                html5QrCodeScannerRef.current = html5Qrcode;

                try {
                    await html5Qrcode.start(
                        cameraId,
                        { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
                        (decodedText) => {
                            console.log("Web QR scan successful:", decodedText);
                            if (editingWorker) {
                                setEditingWorker({ ...editingWorker, qr_code_data: decodedText as UUID });
                            } else {
                                setNewWorker({ ...newWorker, qr_code_data: decodedText as UUID });
                            }
                            playBeep();
                            setScanningQr(false);
                            setIsDialogOpen(true); // Re-open dialog after scan
                        },
                        (errorMessage) => {
                            console.warn(`QR Code Scan Error: ${errorMessage}`);
                        }
                    );
                    console.log("Html5Qrcode.start() called.");
                } catch (err: any) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.error("Caught error during Html5Qrcode.start():", err);
                    showError(t('error_starting_web_camera_scan') + errorMessage + t('check_camera_permissions'));
                    setScanningQr(false);
                    setIsDialogOpen(true); // Re-open dialog even on error
                }
              } else {
                console.error("HTML Element with id=worker-qr-scanner-reader not found during web scan start attempt.");
                showError(t('camera_display_area_not_found'));
                setScanningQr(false);
                setIsDialogOpen(true); // Re-open dialog if element not found
              }
            } else {
              console.warn("No cameras found by Html5Qrcode.getCameras().");
              showError(t('no_camera_found_access_denied'));
              setScanningQr(false);
              setIsDialogOpen(true); // Re-open dialog if no camera
            }
          } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("Caught error during web camera start:", err);
            showError(t('error_starting_web_camera_scan') + errorMessage + t('check_camera_permissions'));
            setScanningQr(false);
            setIsDialogOpen(true); // Re-open dialog on general error
          }
        };
        startWebScanner();
      } else {
        const runNativeScan = async () => {
          const hasPermission = await checkPermission();
          if (!hasPermission) {
            setScanningQr(false);
            setIsDialogOpen(true); // Re-open dialog if no permission
            return;
          }
          setBodyBackground('transparent');
          addCssClass('barcode-scanner-active');
          BarcodeScanner.hideBackground();
          const result = await BarcodeScanner.startScan();
          if (result.hasContent && result.content) {
            console.log("Native QR scan successful:", result.content);
            if (editingWorker) {
              setEditingWorker({ ...editingWorker, qr_code_data: result.content as UUID });
            } else {
              setNewWorker({ ...newWorker, qr_code_data: result.content as UUID });
            }
            playBeep();
            setScanningQr(false);
            setIsDialogOpen(true); // Re-open dialog after scan
          } else {
            showError(t('no_barcode_scanned_cancelled'));
            setScanningQr(false);
            setIsDialogOpen(true); // Re-open dialog if cancelled
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
  }, [scanningQr, isWeb, isTorchOn, t, editingWorker, newWorker]); // Optimized dependencies

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

  const startQrScan = () => {
    setIsDialogOpen(false); // Close dialog before starting full-screen scan
    setScanningQr(true);
  };

  const stopQrScan = () => {
    setScanningQr(false);
    setIsDialogOpen(true); // Re-open dialog when scan is cancelled
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

  const fetchWorkers = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('workers').select('*').eq('user_id', user.id);
    if (error) {
      showError(t('error_fetching_workers') + error.message);
    } else {
      setWorkers(data);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingWorker) {
      setEditingWorker({ ...editingWorker, [name]: value });
    } else {
      setNewWorker({ ...newWorker, [name]: value });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (editingWorker) {
        setEditingWorker({ ...editingWorker, photo: e.target.files[0] });
      } else {
        setNewWorker({ ...newWorker, photo: e.target.files[0] });
      }
    }
  };

  const uploadPhoto = async (file: File | null, workerId: string) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = `worker_photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('worker-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      showError(t('error_uploading_photo') + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath); // Corrected bucket name
    return data.publicUrl;
  };

  const handleAddWorker = async () => {
    if (!newWorker.name) {
      showError(t('fill_worker_name'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const qrDataToUse = newWorker.qr_code_data || (crypto.randomUUID() as UUID);

    const { data: insertedWorker, error: insertError } = await supabase
      .from('workers')
      .insert([{ name: newWorker.name, company: newWorker.company, qr_code_data: qrDataToUse, user_id: user.id }])
      .select()
      .single();

    if (insertError) {
      showError(t('error_adding_worker') + insertError.message);
      return;
    }

    let photoUrl = null;
    if (newWorker.photo && insertedWorker) {
      photoUrl = await uploadPhoto(newWorker.photo, insertedWorker.id); // Changed from uploadImage to uploadPhoto
      if (photoUrl) {
        await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', insertedWorker.id);
      }
    }

    showSuccess(t('worker_added_successfully'));
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() as UUID });
    setIsDialogOpen(false);
    fetchWorkers();
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker || !editingWorker.name) {
      showError(t('fill_worker_name'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let photoUrl = editingWorker.photo_url;
    if (editingWorker.photo instanceof File) {
      photoUrl = await uploadPhoto(editingWorker.photo, editingWorker.id);
    }

    const qrDataToUse = editingWorker.qr_code_data || (crypto.randomUUID() as UUID);

    const { error } = await supabase
      .from('workers')
      .update({
        name: editingWorker.name,
        company: editingWorker.company,
        photo_url: photoUrl,
        qr_code_data: qrDataToUse,
        user_id: user.id
      })
      .eq('id', editingWorker.id);

    if (error) {
      showError(t('error_updating_worker') + error.message);
    } else {
      showSuccess(t('worker_updated_successfully'));
      setEditingWorker(null);
      setIsDialogOpen(false);
      fetchWorkers();
    }
  };

  const handleDeleteWorker = async (id: string) => {
    if (window.confirm(t('confirm_delete_worker'))) {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) {
        showError(t('error_deleting_worker') + error.message);
      } else {
        showSuccess(t('worker_deleted_successfully'));
        fetchWorkers();
      }
    }
  };

  const openEditDialog = (worker: Worker) => {
    setEditingWorker(worker);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingWorker(null);
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() as UUID });
    setScanningQr(false); // Ensure scanner is off when dialog closes
  };

  const handleDownloadQrCode = (workerName: string, qrData: string) => {
    if (qrCodeRef.current) {
      const canvas = qrCodeRef.current;
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workerName}_QR_Code.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSuccess(t('qr_code_downloaded'));
      } else {
        showError(t('qr_code_canvas_not_found'));
      }
    }
  };

  const handleGenerateNewQrCode = () => {
    const newUuid = crypto.randomUUID() as UUID;
    if (editingWorker) {
      setEditingWorker({ ...editingWorker, qr_code_data: newUuid });
    } else {
      setNewWorker({ ...newWorker, qr_code_data: newUuid });
    }
    showSuccess(t('new_qr_code_generated'));
  };

  return (
    <div> {/* Changed from <> to <div> */}
      <audio ref={audioRef} src={beepSound} preload="auto" />
      {scanningQr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          {isWeb ? (
            <>
              <div id="worker-qr-scanner-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
              <Button onClick={stopQrScan} className="mt-4" variant="secondary">
                {t('cancel_scan')}
              </Button>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-black opacity-50"></div>
              <div className="relative z-10 text-white text-lg">
                {t('scanning_for_qr_code')}
                <Button onClick={stopQrScan} className="mt-4 block mx-auto" variant="secondary">
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

      <div className={`min-h-screen flex items-center justify-center p-4 ${scanningQr ? 'hidden' : 'bg-gray-100 dark:bg-gray-900'}`}>
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-3xl font-bold">{t('worker_management_title')}</CardTitle>
                <CardDescription>{t('manage_construction_workers')}</CardDescription>
              </div>
              <div className="w-10"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() as UUID }); setEditingWorker(null); setIsDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_worker')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingWorker ? t('edit_worker') : t('add_new_worker')}</DialogTitle>
                    <DialogDescription>
                      {editingWorker ? t('make_changes_to_worker') : t('add_new_worker_to_system')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        {t('name')}
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        value={editingWorker ? editingWorker.name : newWorker.name}
                        onChange={handleInputChange}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="company" className="text-right">
                        {t('company')}
                      </Label>
                      <Input
                        id="company"
                        name="company"
                        value={editingWorker ? editingWorker.company || '' : newWorker.company}
                        onChange={handleInputChange}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="qr_code_data" className="text-right">
                        {t('qr_code_data')}
                      </Label>
                      <div className="col-span-3 flex items-center gap-2">
                        <Input
                          id="qr_code_data"
                          name="qr_code_data"
                          value={currentQrCodeData || ''}
                          onChange={handleInputChange}
                          className="flex-grow"
                          placeholder={t('enter_qr_code_data')}
                          readOnly={true} {/* Make input read-only as it's filled by scan or generation */}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={startQrScan}>
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={handleGenerateNewQrCode}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {currentQrCodeData && (
                      <div className="col-span-4 flex flex-col items-center gap-2">
                        <div className="p-2 border rounded-md bg-white">
                          <canvas ref={qrCodeRef} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadQrCode(editingWorker?.name || newWorker.name || 'worker', currentQrCodeData)}
                          className="mt-2"
                        >
                          <Download className="mr-2 h-4 w-4" /> {t('download_qr_code')}
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="photo" className="text-right">
                        {t('photo')}
                      </Label>
                      <Input
                        id="photo"
                        name="photo"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="col-span-3"
                      />
                      {editingWorker?.photo_url && (
                        <img src={editingWorker.photo_url} alt={editingWorker.name} className="col-span-4 w-24 h-24 object-cover rounded-full mt-2 mx-auto" />
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                    <Button onClick={editingWorker ? handleUpdateWorker : handleAddWorker}>
                      {editingWorker ? t('save_changes') : t('add_new_worker')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map((worker) => (
                <Card key={worker.id} className="flex flex-col items-center text-center p-4">
                  {worker.photo_url && (
                    <img src={worker.photo_url} alt={worker.name} className="w-24 h-24 object-cover rounded-full mb-4" />
                  )}
                  <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-xl">{worker.name}</CardTitle>
                    <CardDescription>{worker.company || 'N/A'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow p-0">
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('qr_data')}:</strong> {worker.qr_code_data || 'N/A'}</p>
                    {worker.qr_code_data && (
                      <div className="mt-2 flex justify-center">
                        <canvas
                          ref={(el) => {
                            if (el && worker.qr_code_data) {
                              QRCode.toCanvas(el, worker.qr_code_data, { scale: 2 }, function (error) {
                                if (error) console.error(error);
                              });
                            }
                          }}
                          width={64}
                          height={64}
                        />
                      </div>
                    )}
                  </CardContent>
                  <div className="p-4 flex justify-center gap-2 w-full">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(worker)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteWorker(worker.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Link to={`/worker-report/${worker.id}`}>
                      <Button variant="outline" size="icon">
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
              {workers.length === 0 && (
                <p className="col-span-full text-center text-gray-500">{t('no_workers_found')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div> // Changed from </> to </div>
  );
};

export default Workers;