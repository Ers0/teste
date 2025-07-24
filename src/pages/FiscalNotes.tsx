import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showError, showLoading, dismissToast, showSuccess } from '@/utils/toast';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { exportToCsv } from '@/utils/export';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import FiscalNoteForm from '@/components/fiscal-notes/FiscalNoteForm';
import FiscalNoteList from '@/components/fiscal-notes/FiscalNoteList';
import FiscalNoteScanner from '@/components/fiscal-notes/FiscalNoteScanner';

const FiscalNotes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);

  const fiscalNotes = useLiveQuery(() => db.fiscal_notes.orderBy('created_at').reverse().toArray(), []);
  const isLoading = fiscalNotes === undefined;

  const startWebScanner = useCallback(async (onScanSuccess: (decodedText: string) => void) => {
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
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128]
            };
            const html5Qrcode = new Html5Qrcode(readerElement.id, { verbose: false, formatsToSupport: config.formatsToSupport });
            html5QrCodeScannerRef.current = html5Qrcode;
            await html5Qrcode.start(cameraId, config, onScanSuccess, () => {});
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
      showError(t('error_starting_web_camera_scan') + (err instanceof Error ? err.message : String(err)) + t('check_camera_permissions'));
      setScanning(false);
    }
  }, [t]);

  useEffect(() => {
    return () => {
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleRefocus = () => {
    if (html5QrCodeScannerRef.current) {
      html5QrCodeScannerRef.current.stop().catch(console.error).finally(() => {
        startWebScanner((decodedText) => {
          // This is a bit of a hack to pass the setter to the scanner
          const nfeInput = document.getElementById('nfeKey-hidden-input') as HTMLInputElement | null;
          if (nfeInput) {
            nfeInput.value = decodedText;
            nfeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          setScanning(false);
        });
      });
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = showLoading(t('scanning_image'));
    try {
      const html5QrCode = new Html5Qrcode('fiscal-note-reader-hidden', { verbose: false });
      const decodedText = await html5QrCode.scanFile(file, false);
      const nfeInput = document.getElementById('nfeKey-hidden-input') as HTMLInputElement | null;
      if (nfeInput) {
        nfeInput.value = decodedText;
        nfeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showSuccess(t('barcode_scanned_from_image'));
    } catch (err) {
      showError(t('no_barcode_found_in_image'));
    } finally {
      dismissToast(toastId);
      e.target.value = '';
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

  return (
    <React.Fragment>
      <div id="fiscal-note-reader-hidden" style={{ display: 'none' }}></div>
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        {scanning && <FiscalNoteScanner onClose={() => setScanning(false)} onRefocus={handleRefocus} />}
        
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
            <FiscalNoteForm 
              onStartScan={() => {
                setScanning(true);
                startWebScanner((decodedText) => {
                  const nfeInput = document.getElementById('nfeKey-hidden-input') as HTMLInputElement | null;
                  if (nfeInput) {
                    nfeInput.value = decodedText;
                    nfeInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                  setScanning(false);
                });
              }}
              onFileScan={handleFileScan}
            />
            <div className="flex justify-end mb-4">
              <Button onClick={handleExportFiscalNotes} disabled={!fiscalNotes || fiscalNotes.length === 0}>
                <Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}
              </Button>
            </div>
            <FiscalNoteList 
              fiscalNotes={fiscalNotes || []}
              isLoading={isLoading}
              onDelete={handleDeleteFiscalNote}
              onViewImage={setViewingImage}
            />
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