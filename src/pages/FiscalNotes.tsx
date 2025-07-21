import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, ArrowLeft, Camera, Flashlight, FileText, Download } from 'lucide-react';
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

interface FiscalNote {
  id: string;
  nfe_key: string;
  issuer_name: string | null;
  total_value: number | null;
  issue_date: string | null;
  file_url: string | null;
  user_id: string;
  created_at: string;
}

const FiscalNotes = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nfeKey, setNfeKey] = useState('');
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
                let cameraStarted = false;
                for (const camera of cameras) {
                  try {
                    const html5Qrcode = new Html5Qrcode(readerElement.id);
                    html5QrCodeScannerRef.current = html5Qrcode;

                    await html5Qrcode.start(
                      camera.id,
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
                    cameraStarted = true;
                    break;
                  } catch (err: any) {
                    console.error(`Failed to start camera ${camera.id}:`, err);
                  }
                }
                if (!cameraStarted) {
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

  const handleFetchAndSaveFiscalNote = async () => {
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

    // Call Edge Function to simulate fetching data
    const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('fetch-fiscal-note-data', {
      body: { nfe_key: nfeKey },
    });

    if (edgeFunctionError) {
      showError(t('error_fetching_fiscal_note_data') + edgeFunctionError.message);
      return;
    }

    const { data: fetchedData, error: parseError } = edgeFunctionData;

    if (parseError) {
      showError(t('error_parsing_fiscal_note_data') + parseError.message);
      return;
    }

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('fiscal_notes')
      .insert([
        {
          nfe_key: fetchedData.nfe_key,
          issuer_name: fetchedData.issuer_name,
          total_value: parseFloat(fetchedData.total_value),
          issue_date: fetchedData.issue_date,
          file_url: fetchedData.file_url,
          user_id: user.id,
        },
      ]);

    if (insertError) {
      showError(t('error_saving_fiscal_note') + insertError.message);
    } else {
      showSuccess(t('fiscal_note_saved_successfully'));
      setNfeKey('');
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
      [t('issuer_name')]: note.issuer_name || 'N/A',
      [t('total_value')]: note.total_value,
      [t('issue_date')]: note.issue_date ? new Date(note.issue_date).toLocaleString() : 'N/A',
      [t('file_url')]: note.file_url || 'N/A',
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
              <Button onClick={handleFetchAndSaveFiscalNote} className="w-full" disabled={!nfeKey}>
                <FileText className="mr-2 h-4 w-4" /> {t('fetch_and_save_fiscal_note')}
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
                    <TableHead>{t('issuer')}</TableHead>
                    <TableHead className="text-right">{t('total_value')}</TableHead>
                    <TableHead>{t('issue_date')}</TableHead>
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
                        <TableCell>{note.issuer_name || 'N/A'}</TableCell>
                        <TableCell className="text-right">{note.total_value?.toFixed(2) || 'N/A'}</TableCell>
                        <TableCell>{note.issue_date ? new Date(note.issue_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {note.file_url && (
                              <a href={note.file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="icon">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
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