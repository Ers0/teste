import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, ArrowLeft, QrCode, Image as ImageIcon, Camera, Flashlight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import QRCode from '@/components/QRCodeWrapper';
import { v4 as uuidv4 } from 'uuid';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';
import beepSound from '/beep.mp3';

interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: string | null; // System generated QR
  external_qr_code_data: string | null; // New field for pre-existing QR
  user_id: string;
  photo?: File | null; // For file upload
}

const initialNewWorkerState = {
  name: '',
  company: '',
  photo: null as File | null,
  qr_code_data: '',
  external_qr_code_data: '', // Initialize new field
};

const Workers = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newWorker, setNewWorker] = useState<typeof initialNewWorkerState>(initialNewWorkerState);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [qrCodeDataToDisplay, setQrCodeDataToDisplay] = useState('');
  const [externalQrCodeDataToDisplay, setExternalQrCodeDataToDisplay] = useState('');
  const [qrCodeWorkerName, setQrCodeWorkerName] = useState('');
  const navigate = useNavigate();

  // State for external QR scanning
  const [isScanningExternalQr, setIsScanningExternalQr] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Effect for external QR scanning
  useEffect(() => {
    const currentIsWeb = !Capacitor.isNativePlatform();
    setIsWeb(currentIsWeb);

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

    const stopNativeScanner = async () => {
      try {
        await BarcodeScanner.stopScan();
        await BarcodeScanner.showBackground(); // Only for native
        if (isTorchOn) {
          await BarcodeScanner.disableTorch();
          setIsTorchOn(false);
        }
      } catch (e) {
        console.error("Error stopping native barcode scanner:", e);
      } finally {
        setBodyBackground(''); // Only for native
        removeCssClass('barcode-scanner-active'); // Only for native
      }
    };

    if (isScanningExternalQr) {
      if (currentIsWeb) {
        const startWebScanner = async () => {
          // Ensure native scanner is not interfering if it was somehow left active
          await stopNativeScanner();

          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              let cameraId = cameras[0].id; // Default to first camera
              // Try to find a back camera
              const backCamera = cameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('environment')
              );
              if (backCamera) {
                cameraId = backCamera.id;
              } else if (cameras.length > 1) {
                // If no explicit back camera, but more than one camera, try the second one
                // This is a heuristic and might not always be the back camera.
                cameraId = cameras[1].id;
              }

              const readerElementId = "external-qr-reader";
              const readerElement = document.getElementById(readerElementId);

              if (!readerElement) {
                console.error(`HTML Element with id=${readerElementId} not found during web scan start attempt.`);
                showError(t('camera_display_area_not_found'));
                setIsScanningExternalQr(false);
                return;
              }

              // Add a small delay to ensure the DOM is ready
              setTimeout(async () => {
                if (html5QrCodeScannerRef.current) { // Ensure no previous instance is running
                  await html5QrCodeScannerRef.current.stop().catch(() => {}); // Stop if somehow still running
                  html5QrCodeScannerRef.current.clear(); // Clear it
                  html5QrCodeScannerRef.current = null;
                }

                try {
                  const html5Qrcode = new Html5Qrcode(readerElement.id);
                  html5QrCodeScannerRef.current = html5Qrcode;

                  await html5Qrcode.start(
                    cameraId,
                    { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
                    (decodedText) => {
                      console.log("Web scan successful:", decodedText);
                      if (editingWorker) {
                        setEditingWorker({ ...editingWorker, external_qr_code_data: decodedText });
                      } else {
                        setNewWorker({ ...newWorker, external_qr_code_data: decodedText });
                      }
                      playBeep();
                      setIsScanningExternalQr(false); // This will trigger cleanup
                    },
                    (errorMessage) => {
                      console.warn(`QR Code Scan Error: ${errorMessage}`);
                      // Do not stop scanning here, let the loop continue trying other cameras
                    }
                  );
                } catch (err: any) {
                  console.error(`Failed to start camera ${cameraId}:`, err);
                  showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
                  setIsScanningExternalQr(false);
                }
              }, 200); // Increased delay
            } else {
              showError(t('no_camera_found_access_denied'));
              setIsScanningExternalQr(false);
            }
          } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            showError(t('error_starting_web_camera_scan') + errorMessage + t('check_camera_permissions'));
            setIsScanningExternalQr(false);
          }
        };
        startWebScanner();
      } else { // Native path
        const runNativeScan = async () => {
          // Ensure web scanner is not interfering
          await stopWebScanner();

          const hasPermission = await checkPermission();
          if (!hasPermission) {
            setIsScanningExternalQr(false);
            return;
          }
          setBodyBackground('transparent'); // Only for native
          addCssClass('barcode-scanner-active'); // Only for native
          BarcodeScanner.hideBackground(); // Only for native
          const result = await BarcodeScanner.startScan();
          if (result.hasContent && result.content) {
            console.log("Native scan successful:", result.content);
            if (editingWorker) {
              setEditingWorker({ ...editingWorker, external_qr_code_data: result.content });
            } else {
              setNewWorker({ ...newWorker, external_qr_code_data: result.content });
            }
            playBeep();
            setIsScanningExternalQr(false); // This will trigger cleanup
          } else {
            showError(t('no_barcode_scanned_cancelled'));
            setIsScanningExternalQr(false); // This will trigger cleanup
          }
        };
        runNativeScan();
      }
    } else { // isScanningExternalQr is false, stop all
      stopWebScanner();
      stopNativeScanner();
    }

    return () => {
      stopWebScanner();
      stopNativeScanner();
    };
  }, [isScanningExternalQr, isWeb, editingWorker, newWorker]);

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

  const startExternalQrScan = () => {
    setIsScanningExternalQr(true);
  };

  const stopExternalQrScan = () => {
    setIsScanningExternalQr(false);
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

    const { data, error } = await supabase
      .from('workers')
      .select('*, external_qr_code_data') // Select new field
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      showError(t('error_fetching_workers') + error.message);
    } else {
      setWorkers(data || []);
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

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddWorker = async () => {
    if (!newWorker.name.trim()) {
      showError(t('worker_name_required'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const generatedQrCodeData = uuidv4(); // Generate a unique QR code data

    const { data: insertedWorker, error: insertError } = await supabase
      .from('workers')
      .insert([{ 
        name: newWorker.name, 
        company: newWorker.company, 
        qr_code_data: generatedQrCodeData,
        external_qr_code_data: newWorker.external_qr_code_data.trim() || null, // Save new field
        user_id: user.id 
      }])
      .select()
      .single();

    if (insertError) {
      showError(t('error_adding_worker') + insertError.message);
      return;
    }

    let photoUrl = null;
    if (newWorker.photo && insertedWorker) {
      photoUrl = await uploadPhoto(newWorker.photo, insertedWorker.id);
      if (photoUrl) {
        await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', insertedWorker.id);
      }
    }

    showSuccess(t('worker_added_successfully'));
    setNewWorker(initialNewWorkerState);
    setIsDialogOpen(false);
    fetchWorkers();
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker || !editingWorker.name.trim()) {
      showError(t('worker_name_required'));
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

    const { error } = await supabase
      .from('workers')
      .update({
        name: editingWorker.name,
        company: editingWorker.company,
        photo_url: photoUrl,
        qr_code_data: editingWorker.qr_code_data, // Keep existing system-generated QR code data
        external_qr_code_data: editingWorker.external_qr_code_data?.trim() || null, // Update new field
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
    setNewWorker(initialNewWorkerState);
  };

  const openQrCodeDialog = (systemQrData: string | null, externalQrData: string | null, workerName: string) => {
    setQrCodeDataToDisplay(systemQrData || '');
    setExternalQrCodeDataToDisplay(externalQrData || '');
    setQrCodeWorkerName(workerName);
    setIsQrCodeDialogOpen(true);
  };

  const closeQrCodeDialog = () => {
    setIsQrCodeDialogOpen(false);
    setQrCodeDataToDisplay('');
    setExternalQrCodeDataToDisplay('');
    setQrCodeWorkerName('');
  };

  return (
    <React.Fragment>
      <audio ref={audioRef} src={beepSound} preload="auto" />
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        {/* Scanner overlay, always rendered but conditionally visible */}
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${isScanningExternalQr ? '' : 'hidden'}`}>
          {isWeb ? (
            <>
              <div id="external-qr-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
              <Button onClick={stopExternalQrScan} className="mt-4" variant="secondary">
                {t('cancel_scan')}
              </Button>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-black opacity-50"></div>
              <div className="relative z-10 text-white text-lg">
                {t('scanning_for_qr_code')}
                <Button onClick={stopExternalQrScan} className="mt-4 block mx-auto" variant="secondary">
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

        <Card className={`w-full max-w-4xl mx-auto ${isScanningExternalQr ? 'hidden' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-3xl font-bold">{t('worker_management_title')}</CardTitle>
                <CardDescription>{t('manage_your_workers')}</CardDescription>
              </div>
              <div className="w-10"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setNewWorker(initialNewWorkerState); setEditingWorker(null); setIsDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_worker')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingWorker ? t('edit_worker') : t('add_new_worker')}</DialogTitle>
                    <DialogDescription>
                      {editingItem ? t('make_changes_to_worker') : t('add_new_worker_to_system')}
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
                      <Label htmlFor="external_qr_code_data" className="text-right">
                        {t('external_qr_code')}
                      </Label>
                      <Input
                        id="external_qr_code_data"
                        name="external_qr_code_data"
                        value={editingWorker ? editingWorker.external_qr_code_data || '' : newWorker.external_qr_code_data}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder={t('optional_pre_existing_qr')}
                      />
                      <Button variant="outline" size="icon" className="col-span-1 ml-auto" onClick={startExternalQrScan}>
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
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
                      {(editingWorker?.photo_url || (newWorker.photo && URL.createObjectURL(newWorker.photo))) && (
                        <img 
                          src={editingWorker?.photo_url || (newWorker.photo ? URL.createObjectURL(newWorker.photo) : '')} 
                          alt={editingWorker?.name || newWorker.name || t('worker_photo')} 
                          className="col-span-4 w-24 h-24 object-cover rounded-full mt-2 mx-auto" 
                        />
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                    <Button onClick={editingWorker ? handleUpdateWorker : handleAddWorker}>
                      {editingWorker ? t('save_changes') : t('add_worker')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t('photo')}</TableHead>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('company')}</TableHead>
                    <TableHead className="text-center">{t('qr_code')}</TableHead>
                    <TableHead className="text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                        {t('no_workers_found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    workers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell>
                          {worker.photo_url ? (
                            <img src={worker.photo_url} alt={worker.name} className="w-16 h-16 object-cover rounded-full" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 text-xs">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{worker.name}</TableCell>
                        <TableCell>{worker.company || 'N/A'}</TableCell>
                        <TableCell className="text-center">
                          {(worker.qr_code_data || worker.external_qr_code_data) ? (
                            <Button variant="outline" size="sm" onClick={() => openQrCodeDialog(worker.qr_code_data, worker.external_qr_code_data, worker.name)}>
                              <QrCode className="h-4 w-4 mr-2" /> {t('view_qr')}
                            </Button>
                          ) : (
                            <span className="text-gray-500">{t('not_available')}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => openEditDialog(worker)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteWorker(worker.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Link to={`/worker-report/${worker.id}`}>
                              <Button variant="outline" size="icon">
                                <ImageIcon className="h-4 w-4" /> {/* Reusing ImageIcon for report, consider a more fitting icon if available */}
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Display Dialog */}
        <Dialog open={isQrCodeDialogOpen} onOpenChange={setIsQrCodeDialogOpen}>
          <DialogContent className="sm:max-w-[350px] text-center">
            <DialogHeader>
              <DialogTitle>{t('qr_code_for', { workerName: qrCodeWorkerName })}</DialogTitle>
              <DialogDescription>
                {t('scan_this_qr_code')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-4 space-y-4">
              {qrCodeDataToDisplay && (
                <div className="border p-2 rounded-md">
                  <p className="text-sm font-semibold mb-2">{t('system_generated_qr')}</p>
                  <QRCode value={qrCodeDataToDisplay} size={200} level="H" />
                </div>
              )}
              {externalQrCodeDataToDisplay && (
                <div className="border p-2 rounded-md">
                  <p className="text-sm font-semibold mb-2">{t('external_qr_code')}</p>
                  <QRCode value={externalQrCodeDataToDisplay} size={200} level="H" />
                </div>
              )}
              {!qrCodeDataToDisplay && !externalQrCodeDataToDisplay && (
                <p className="text-gray-500">{t('no_qr_codes_available')}</p>
              )}
            </div>
            <DialogFooter className="flex justify-center">
              <Button onClick={closeQrCodeDialog}>{t('close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </React.Fragment>
  );
};

export default Workers;