import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Barcode, ArrowLeft, Camera, Flashlight, FileText, Download, Trash2, CalendarIcon, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import beepSound from '/beep.mp3';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCsv } from '@/utils/export';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { v4 as uuidv4 } from 'uuid';

interface FiscalNote {
  id: string;
  nfe_key: string;
  description: string | null;
  arrival_date: string | null;
  user_id: string;
  created_at: string;
  photo_url: string | null;
}

const FiscalNotes = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nfeKey, setNfeKey] = useState('');
  const [description, setDescription] = useState('');
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fiscalNotes, setFiscalNotes] = useState<FiscalNote[]>([]);
  const [scanning, setScanning] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
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
      fetchFiscalNotes();
    }
  }, [user]);

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
        await BarcodeScanner.showBackground();
        if (isTorchOn) {
          await BarcodeScanner.disableTorch();
          setIsTorchOn(false);
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
          await stopNativeScanner(); // Ensure native scanner is stopped
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              let cameraId = cameras[0].id; // Default to first camera
              const backCamera = cameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('environment')
              );
              if (backCamera) {
                cameraId = backCamera.id;
              } else if (cameras.length > 1) {
                cameraId = cameras[1].id;
              }

              const readerElementId = "fiscal-note-reader";
              const readerElement = document.getElementById(readerElementId);

              if (!readerElement) {
                console.error(`HTML Element with id=${readerElementId} not found during web scan start attempt.`);
                showError(t('camera_display_area_not_found'));
                setScanning(false);
                return;
              }

              setTimeout(async () => {
                if (html5QrCodeScannerRef.current) {
                  await html5QrCodeScannerRef.current.stop().catch(() => {});
                  html5QrCodeScannerRef.current.clear();
                  html5QrCodeScannerRef.current = null;
                }
                try {
                  const config = {
                    fps: 10,
                    qrbox: { width: 300, height: 150 },
                    disableFlip: false,
                    formatsToSupport: [
                      Html5QrcodeSupportedFormats.QR_CODE,
                      Html5QrcodeSupportedFormats.CODE_128,
                    ]
                  };
                  const html5Qrcode = new Html5Qrcode(readerElement.id, { verbose: false, formatsToSupport: config.formatsToSupport });
                  html5QrCodeScannerRef.current = html5Qrcode;

                  await html5Qrcode.start(
                    cameraId,
                    config,
                    (decodedText) => {
                      console.log("Web scan successful:", decodedText);
                      setNfeKey(decodedText);
                      playBeep();
                      setScanning(false);
                    },
                    (errorMessage) => {
                      // This callback is called frequently, even for non-errors.
                    }
                  );
                } catch (err: any) {
                  console.error(`Failed to start camera ${cameraId}:`, err);
                  showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
                  setScanning(false);
                }
              }, 200);
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
      } else { // Native path
        const runNativeScan = async () => {
          await stopWebScanner(); // Ensure web scanner is stopped
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
            setNfeKey(result.content);
            playBeep();
            setScanning(false);
          } else {
            showError(t('no_barcode_scanned_cancelled'));
            setScanning(false);
          }
        };
        runNativeScan();
      }
    } else { // scanning is false, stop all
      stopWebScanner();
      stopNativeScanner();
    }

    return () => {
      stopWebScanner();
      stopNativeScanner();
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
    setNfeKey('');
    setDescription('');
    setArrivalDate(undefined);
    setPhoto(null);
    setScanning(true);
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

  const fetchFiscalNotes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('fiscal_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError(t('error_fetching_fiscal_notes') + error.message);
    } else {
      setFiscalNotes(data || []);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const uploadPhoto = async (file: File, fiscalNoteId: string) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${fiscalNoteId}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('fiscal-note-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      showError(t('error_uploading_photo') + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('fiscal-note-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSaveFiscalNote = async () => {
    if (!nfeKey) {
      showError(t('enter_nfe_key_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data: existingNote, error: existingError } = await supabase
      .from('fiscal_notes')
      .select('id')
      .eq('nfe_key', nfeKey)
      .eq('user_id', user.id)
      .single();

    if (existingNote) {
      showError(t('fiscal_note_already_exists'));
      return;
    }
    if (existingError && existingError.code !== 'PGRST116') {
      showError(t('error_checking_existing_fiscal_note') + existingError.message);
      return;
    }

    const toastId = showLoading(t('saving_fiscal_note'));
    let photoUrl: string | null = null;
    const fiscalNoteId = uuidv4();

    try {
      if (photo) {
        photoUrl = await uploadPhoto(photo, fiscalNoteId);
        if (!photoUrl) {
          dismissToast(toastId);
          return;
        }
      }

      const { error: insertError } = await supabase
        .from('fiscal_notes')
        .insert([{
          id: fiscalNoteId,
          nfe_key: nfeKey,
          description: description.trim() || null,
          arrival_date: arrivalDate ? arrivalDate.toISOString() : null,
          user_id: user.id,
          photo_url: photoUrl,
        }]);

      if (insertError) {
        throw insertError;
      }

      dismissToast(toastId);
      showSuccess(t('fiscal_note_saved_successfully'));
      setNfeKey('');
      setDescription('');
      setArrivalDate(undefined);
      setPhoto(null);
      fetchFiscalNotes();
    } catch (error: any) {
      dismissToast(toastId);
      showError(t('error_saving_fiscal_note') + error.message);
    }
  };

  const handleDeleteFiscalNote = async (id: string) => {
    if (window.confirm(t('confirm_delete_fiscal_note'))) {
      const noteToDelete = fiscalNotes.find(note => note.id === id);
      if (noteToDelete && noteToDelete.photo_url) {
        const urlParts = noteToDelete.photo_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('fiscal-note-photos')
            .remove([fileName]);
          if (storageError) {
            showError(t('error_deleting_photo_from_storage') + storageError.message);
          }
        }
      }

      const { error } = await supabase.from('fiscal_notes').delete().eq('id', id);
      if (error) {
        showError(t('error_deleting_fiscal_note') + error.message);
      } else {
        showSuccess(t('fiscal_note_deleted_successfully'));
        fetchFiscalNotes();
      }
    }
  };

  const handleExportFiscalNotes = () => {
    if (!fiscalNotes || fiscalNotes.length === 0) {
      showError(t('no_fiscal_notes_to_export'));
      return;
    }

    const formattedData = fiscalNotes.map(note => ({
      [t('nfe_key')]: note.nfe_key,
      [t('fiscal_note_description')]: note.description || 'N/A',
      [t('fiscal_note_arrival_date')]: note.arrival_date ? new Date(note.arrival_date).toLocaleDateString() : 'N/A',
      [t('created_at')]: new Date(note.created_at).toLocaleString(),
    }));

    exportToCsv(formattedData, 'fiscal_notes_report.csv');
    showSuccess(t('fiscal_notes_report_downloaded'));
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const toastId = showLoading(t('scanning_image'));
    try {
      const html5QrCode = new Html5Qrcode('fiscal-note-reader-hidden', { 
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
        ]
      });
      const decodedText = await html5QrCode.scanFile(file, false);
      setNfeKey(decodedText);
      playBeep();
      showSuccess(t('barcode_scanned_from_image'));
    } catch (err) {
      console.error("Error scanning file:", err);
      showError(t('no_barcode_found_in_image'));
    } finally {
      dismissToast(toastId);
      e.target.value = '';
    }
  };

  return (
    <React.Fragment>
      <audio ref={audioRef} src={beepSound} preload="auto" />
      <div id="fiscal-note-reader-hidden" style={{ display: 'none' }}></div>
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${scanning ? '' : 'hidden'}`}>
          {isWeb ? (
            <>
              <div id="fiscal-note-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
              <Button onClick={stopScan} className="mt-4" variant="secondary">
                {t('cancel_scan')}
              </Button>
              <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
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
                <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
              </div>
            </>
          )}
        </div>

        <Card className={`w-full max-w-4xl mx-auto ${scanning ? 'hidden' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-3xl font-bold">{t('fiscal_notes_management')}</CardTitle>
                <CardDescription>{t('manage_your_fiscal_notes')}</CardDescription>
              </div>
              <div className="w-10"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 border-b pb-4 mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Barcode className="mr-2 h-5 w-5" /> {t('scan_fiscal_note_barcode')}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="text"
                  placeholder={t('enter_nfe_key_manually')}
                  value={nfeKey}
                  onChange={(e) => setNfeKey(e.target.value)}
                  className="flex-grow"
                />
                <Button onClick={startScan}>
                  <Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}
                </Button>
                {isWeb && (
                  <Button asChild variant="outline">
                    <Label htmlFor="scan-file-input">
                      <ImageIcon className="mr-2 h-4 w-4" /> {t('scan_from_image')}
                      <Input id="scan-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileScan} />
                    </Label>
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Input
                  id="description"
                  type="text"
                  placeholder={t('enter_brief_description')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrivalDate">{t('arrival_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !arrivalDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {arrivalDate ? format(arrivalDate, "PPP") : <span>{t('pick_a_date')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={arrivalDate}
                      onSelect={setArrivalDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo">{t('photo')}</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
                {photo && (
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt="Preview" 
                    className="w-24 h-24 object-cover rounded-md mt-2" 
                  />
                )}
              </div>
              <Button onClick={handleSaveFiscalNote} className="w-full" disabled={!nfeKey}>
                <FileText className="mr-2 h-4 w-4" /> {t('save_fiscal_note')}
              </Button>
            </div>

            <div className="flex justify-end mb-4">
              <Button onClick={handleExportFiscalNotes} disabled={fiscalNotes.length === 0}>
                <Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('photo')}</TableHead>
                    <TableHead>{t('nfe_key')}</TableHead>
                    <TableHead>{t('fiscal_note_description')}</TableHead>
                    <TableHead>{t('fiscal_note_arrival_date')}</TableHead>
                    <TableHead className="text-right">{t('created_at')}</TableHead>
                    <TableHead className="text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fiscalNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                        {t('no_fiscal_notes_found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    fiscalNotes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell>
                          {note.photo_url ? (
                            <img 
                              src={note.photo_url} 
                              alt={t('fiscal_note')} 
                              className="w-16 h-16 object-cover rounded-md cursor-pointer"
                              onClick={() => setViewingImage(note.photo_url)}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-500">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{note.nfe_key}</TableCell>
                        <TableCell>{note.description || 'N/A'}</TableCell>
                        <TableCell>{note.arrival_date ? new Date(note.arrival_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="text-right">{new Date(note.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteFiscalNote(note.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-3xl">
            <img src={viewingImage || ''} alt={t('fiscal_note_large_view')} className="w-full h-auto rounded-md" />
          </DialogContent>
        </Dialog>
      </div>
    </React.Fragment>
  );
};

export default FiscalNotes;