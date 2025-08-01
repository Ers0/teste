import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Barcode, ArrowLeft, Camera, FileText, Download, Trash2, CalendarIcon, Image as ImageIcon, Focus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
import CameraCapture from '@/components/CameraCapture';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { FiscalNote } from '@/types';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { playBeep } from '@/utils/sound';

const FiscalNotes = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [nfeKey, setNfeKey] = useState('');
  const [description, setDescription] = useState('');
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fiscalNotesUnsorted = useLiveQuery(() => db.fiscal_notes.toArray(), []);
  const fiscalNotes = useMemo(() => {
    if (!fiscalNotesUnsorted) return undefined;
    return fiscalNotesUnsorted.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
    });
  }, [fiscalNotesUnsorted]);
  
  const isLoading = fiscalNotes === undefined;

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleDateString();
  };

  const startWebScanner = useCallback(async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        let cameraId = cameras[0].id;
        const backCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('environment')
        );
        if (backCamera) cameraId = backCamera.id;
        else if (cameras.length > 1) cameraId = cameras[1].id;

        const readerElementId = "fiscal-note-reader";
        const readerElement = document.getElementById(readerElementId);

        if (!readerElement) {
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
                playBeep();
                setNfeKey(decodedText);
                setScanning(false);
              },
              () => {}
            );
          } catch (err: any) {
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
    setNfeKey('');
    setDescription('');
    setArrivalDate(undefined);
    setPhoto(null);
    setScanning(true);
  };

  const stopScan = () => {
    setScanning(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const uploadPhoto = async (file: File, fiscalNoteId: string) => {
    if (!file || !user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${fiscalNoteId}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

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

    const existingNote = fiscalNotes?.find(note => note.nfe_key === nfeKey);
    if (existingNote) {
      showError(t('fiscal_note_already_exists'));
      return;
    }

    let photoUrl = null;
    if (isOnline && photo) {
      photoUrl = await uploadPhoto(photo, uuidv4());
    } else if (!isOnline && photo) {
      showError("Photo upload is not available offline.");
    }

    const newNote: FiscalNote = {
      id: uuidv4(),
      nfe_key: nfeKey,
      description: description.trim() || null,
      arrival_date: arrivalDate ? arrivalDate.toISOString() : null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      photo_url: photoUrl,
    };

    try {
      await db.fiscal_notes.add(newNote);
      await db.outbox.add({ type: 'create', table: 'fiscal_notes', payload: newNote, timestamp: Date.now() });
      showSuccess(t('fiscal_note_saved_locally'));
      setNfeKey('');
      setDescription('');
      setArrivalDate(undefined);
      setPhoto(null);
    } catch (error: any) {
      showError(t('error_saving_fiscal_note') + error.message);
    }
  };

  const handleDeleteFiscalNote = async (id: string) => {
    if (window.confirm(t('confirm_delete_fiscal_note'))) {
      try {
        await db.fiscal_notes.delete(id);
        await db.outbox.add({ type: 'delete', table: 'fiscal_notes', payload: { id }, timestamp: Date.now() });
        showSuccess(t('fiscal_note_deleted_locally'));
      } catch (error: any) {
        showError(t('error_deleting_fiscal_note') + error.message);
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
      [t('created_at')]: note.created_at ? new Date(note.created_at).toLocaleString() : 'N/A',
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
      playBeep();
      setNfeKey(decodedText);
      showSuccess(t('barcode_scanned_from_image'));
    } catch (err) {
      console.error("Error scanning file:", err);
      showError(t('no_barcode_found_in_image'));
    } finally {
      dismissToast(toastId);
      e.target.value = '';
    }
  };

  const handlePhotoCaptured = (file: File) => {
    setPhoto(file);
    setIsCameraOpen(false);
  };

  return (
    <React.Fragment>
      <div id="fiscal-note-reader-hidden" style={{ display: 'none' }}></div>
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${scanning ? '' : 'hidden'}`}>
          <div id="fiscal-note-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
          <div className="mt-4 flex gap-2">
            <Button onClick={stopScan} variant="secondary">
              {t('cancel_scan')}
            </Button>
            <Button onClick={handleRefocus} variant="outline">
              <Focus className="mr-2 h-4 w-4" /> {t('refocus')}
            </Button>
          </div>
          <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
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
                <Button asChild variant="outline">
                  <Label htmlFor="scan-file-input">
                    <ImageIcon className="mr-2 h-4 w-4" /> {t('scan_from_image')}
                    <Input id="scan-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileScan} />
                  </Label>
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
              <div className="space-y-2">
                <Label htmlFor="photo">{t('photo')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="flex-grow">
                    <Label htmlFor="photo-file-input" className="cursor-pointer">
                      <ImageIcon className="mr-2 h-4 w-4" /> {t('select_image')}
                      <Input id="photo-file-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </Label>
                  </Button>
                  <Button variant="outline" onClick={() => setIsCameraOpen(true)} className="flex-grow">
                    <Camera className="mr-2 h-4 w-4" /> {t('take_photo')}
                  </Button>
                </div>
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
              <Button onClick={handleExportFiscalNotes} disabled={!fiscalNotes || fiscalNotes.length === 0}>
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
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('loading_fiscal_notes')}</TableCell></TableRow>
                  ) : fiscalNotes && fiscalNotes.length > 0 ? (
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
                        <TableCell>{safeFormatDate(note.arrival_date)}</TableCell>
                        <TableCell className="text-right">{safeFormatDate(note.created_at)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteFiscalNote(note.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                        {t('no_fiscal_notes_found')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {isCameraOpen && (
          <CameraCapture
            onCapture={handlePhotoCaptured}
            onClose={() => setIsCameraOpen(false)}
          />
        )}

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