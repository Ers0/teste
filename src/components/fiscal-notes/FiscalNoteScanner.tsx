import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Focus } from 'lucide-react';

interface FiscalNoteScannerProps {
  onClose: () => void;
  onRefocus: () => void;
}

const FiscalNoteScanner: React.FC<FiscalNoteScannerProps> = ({ onClose, onRefocus }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      <div id="fiscal-note-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
      <div className="mt-4 flex gap-2">
        <Button onClick={onClose} variant="secondary">
          {t('cancel_scan')}
        </Button>
        <Button onClick={onRefocus} variant="outline">
          <Focus className="mr-2 h-4 w-4" /> {t('refocus')}
        </Button>
      </div>
      <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
    </div>
  );
};

export default FiscalNoteScanner;