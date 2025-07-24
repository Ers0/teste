import React, { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { showError } from '@/utils/toast';
import { playBeep } from '@/utils/sound';
import { Focus } from 'lucide-react';

interface ScannerProps {
  readerElementId: string;
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ readerElementId, onScanSuccess, onClose }) => {
  const { t } = useTranslation();
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = React.useCallback(async () => {
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

        const readerElement = document.getElementById(readerElementId);
        if (readerElement) {
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
                  Html5QrcodeSupportedFormats.EAN_13,
                  Html5QrcodeSupportedFormats.EAN_8,
                  Html5QrcodeSupportedFormats.UPC_A,
                  Html5QrcodeSupportedFormats.UPC_E,
                ]
              };
              const html5Qrcode = new Html5Qrcode(readerElementId, { verbose: false, formatsToSupport: config.formatsToSupport });
              html5QrCodeScannerRef.current = html5Qrcode;

              await html5Qrcode.start(
                cameraId,
                config,
                (decodedText) => {
                  playBeep();
                  onScanSuccess(decodedText);
                },
                () => {}
              );
            } catch (err: any) {
              showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
              onClose();
            }
          }, 200);
        } else {
          showError(t('camera_display_area_not_found'));
          onClose();
        }
      } else {
        showError(t('no_camera_found_access_denied'));
        onClose();
      }
    } catch (err: any) {
      showError(t('error_starting_web_camera_scan') + (err.message || err) + t('check_camera_permissions'));
      onClose();
    }
  }, [onScanSuccess, onClose, readerElementId, t]);

  useEffect(() => {
    startScanner();
    return () => {
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.stop().catch(() => {});
        html5QrCodeScannerRef.current.clear();
      }
    };
  }, [startScanner]);

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
    setTimeout(startScanner, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-80">
      <div id={readerElementId} className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
      <div className="mt-4 flex gap-2">
        <Button onClick={onClose} variant="secondary">
          {t('cancel_scan')}
        </Button>
        <Button onClick={handleRefocus} variant="outline">
          <Focus className="mr-2 h-4 w-4" /> {t('refocus')}
        </Button>
      </div>
    </div>
  );
};

export default Scanner;