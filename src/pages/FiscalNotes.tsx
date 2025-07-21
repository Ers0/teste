import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, ArrowLeft, Camera, Flashlight, FileText, Download, Trash2, CalendarIcon } from 'lucide-react'; // Import CalendarIcon from lucide-react
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';
import { Capacitor } from '@capacitor/core';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import beepSound from '/beep.mp3';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCsv } from '@/utils/export';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface FiscalNote {
  id: string;
  nfe_key: string;
  description: string | null; // New field
  arrival_date: string | null; // New field
  user_id: string;
  created_at: string;
}

const FiscalNotes = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nfeKey, setNfeKey] = useState('');
  const [description, setDescription] = useState(''); // State for description
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined); // State for arrival date
  const [fiscalNotes, setFiscalNotes] = useState<FiscalNote[]>([]);
  const [scanning, setScanning] = useState(false);
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
              // Try to find a back camera
              const backCamera = cameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('environment')
              );
              if (backCamera) {
                cameraId = backCamera.id;
              } else if (cameras.length > 1) {
                // If no explicit back camera, but more than one camera, try the second one
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
                  const html5Qrcode = new Html5Qrcode(readerElement.id);
                  html5QrCodeScannerRef.current = html5Qrcode;

                  await html5Qrcode.start(
                    cameraId,
                    { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
                    (decodedText) => {
                      console.log("Web scan successful:", decodedText);
                      setNfeKey(decodedText);
                      playBeep();
                      setScanning(false);
                    },
                    (errorMessage) => {
                      console.warn(`QR Code Scan Error: ${errorMessage}`);
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

  const handleSaveFiscalNote = async () => {
    if (!nfeKey) {
      showError(t('enter_nfe_key_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    // Check if fiscal note with this key already exists for the user
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
    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 means no rows found
      showError(t('error_checking_existing_fiscal_note') + existingError.message);
      return;
    }

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('fiscal_notes')
      .insert([
        {
          nfe_key: nfeKey,
          description: description.trim() || null,
          arrival_date: arrivalDate ? arrivalDate.toISOString() : null,
          user_id: user.id,
        },
      ]);

    if (insertError) {
      showError(t('error_saving_fiscal_note') + insertError.message);
    } else {
      showSuccess(t('fiscal_note_saved_successfully'));
      setNfeKey('');
      setDescription('');
      setArrivalDate(undefined);
      fetchFiscalNotes(); // Refresh the list
    }
  };

  const handleDeleteFiscalNote = async (id: string) => {
    if (window.confirm(t('confirm_delete_fiscal_note'))) {
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

  return (
    <React.Fragment>
      <audio ref={audioRef} src={beepSound} preload="auto" />
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        {/* Scanner overlay */}
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${scanning ? '' : 'hidden'}`}>
          {isWeb ? (
            <>
              <div id="fiscal-note-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
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
              <div className="flex items-center space-x-2">
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
                      <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                        {t('no_fiscal_notes_found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    fiscalNotes.map((note) => (
                      <TableRow key={note.id}>
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
      </div>
    </React.Fragment>
  );
};

export default FiscalNotes;