import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, QrCode, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Worker } from '@/types';
import AssignedPpeStatus from '@/components/dashboard/AssignedPpeStatus';

interface WorkerSelectionProps {
  selectionMode: 'worker' | 'company';
  onSelectionModeChange: (mode: 'worker' | 'company') => void;
  scannedWorker: Worker | null;
  workerQrCodeInput: string;
  onWorkerQrCodeInputChange: (value: string) => void;
  onStartWorkerScan: () => void;
  onScanWorker: (qrCode: string) => void;
  workerSearchTerm: string;
  onWorkerSearchTermChange: (value: string) => void;
  onSearchWorkerByName: () => void;
  workerSearchResults: Worker[];
  onSelectWorker: (worker: Worker) => void;
  handleClearWorker: () => void;
  selectedCompany: string | null;
  onSelectedCompanyChange: (company: string) => void;
  companies: string[];
}

const WorkerSelection: React.FC<WorkerSelectionProps> = ({
  selectionMode, onSelectionModeChange, scannedWorker, workerQrCodeInput,
  onWorkerQrCodeInputChange, onStartWorkerScan, onScanWorker, workerSearchTerm,
  onWorkerSearchTermChange, onSearchWorkerByName, workerSearchResults,
  onSelectWorker, handleClearWorker, selectedCompany, onSelectedCompanyChange, companies
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-b pb-4">
      <h3 className="text-lg font-semibold flex items-center">
        <Users className="mr-2 h-5 w-5" /> {t('recipient')}
      </h3>
      <ToggleGroup type="single" value={selectionMode} onValueChange={(value: 'worker' | 'company') => value && onSelectionModeChange(value)} className="grid grid-cols-2 gap-2">
        <ToggleGroupItem value="worker">{t('worker')}</ToggleGroupItem>
        <ToggleGroupItem value="company">{t('company')}</ToggleGroupItem>
      </ToggleGroup>

      {selectionMode === 'worker' && !scannedWorker && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="text" placeholder={t('enter_worker_qr_code')} value={workerQrCodeInput} onChange={(e) => onWorkerQrCodeInputChange(e.target.value)} className="flex-grow" />
            <Button onClick={onStartWorkerScan}><Camera className="mr-2 h-4 w-4" /> {t('scan_worker_qr')}</Button>
          </div>
          {workerQrCodeInput && <Button onClick={() => onScanWorker(workerQrCodeInput)} className="w-full"><QrCode className="mr-2 h-4 w-4" /> {t('search_worker_by_qr')}</Button>}
          <div className="text-center text-sm text-muted-foreground my-2">{t('or')}</div>
          <div className="flex items-center space-x-2">
            <Input type="text" placeholder={t('enter_worker_name_to_search')} value={workerSearchTerm} onChange={(e) => onWorkerSearchTermChange(e.target.value)} className="flex-grow" />
            <Button onClick={onSearchWorkerByName}><Search className="mr-2 h-4 w-4" /> {t('search_worker_by_name')}</Button>
          </div>
          {workerSearchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
              <p className="text-sm font-medium">{t('select_worker_from_results')}:</p>
              {workerSearchResults.map((worker) => (
                <Button key={worker.id} variant="outline" className="w-full justify-start" onClick={() => onSelectWorker(worker)}>
                  {worker.name} ({worker.company || t('no_company')})
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      {selectionMode === 'worker' && scannedWorker && (
        <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
          <p><strong>{t('name')}:</strong> {scannedWorker.name}</p>
          <p><strong>{t('company')}:</strong> {scannedWorker.company || 'N/A'}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleClearWorker}>{t('change_worker')}</Button>
        </div>
      )}
      {selectionMode === 'company' && (
        <div className="space-y-2">
          <Label htmlFor="company-select">{t('select_company')}</Label>
          <Select onValueChange={onSelectedCompanyChange} value={selectedCompany || ''}>
            <SelectTrigger id="company-select"><SelectValue placeholder={t('select_a_company')} /></SelectTrigger>
            <SelectContent>{companies?.map(company => (<SelectItem key={company} value={company}>{company}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      )}
      {scannedWorker && <AssignedPpeStatus worker={scannedWorker} />}
    </div>
  );
};

export default WorkerSelection;