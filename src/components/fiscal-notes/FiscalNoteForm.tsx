import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Barcode, Camera, FileText, CalendarIcon, Image as ImageIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFiscalNoteForm } from '@/hooks/useFiscalNoteForm';
import CameraCapture from '@/components/CameraCapture';

interface FiscalNoteFormProps {
  onStartScan: () => void;
  onFileScan: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FiscalNoteForm: React.FC<FiscalNoteFormProps> = ({ onStartScan, onFileScan }) => {
  const { t } = useTranslation();
  const {
    nfeKey, setNfeKey,
    description, setDescription,
    arrivalDate, setArrivalDate,
    photo, setPhoto,
    handleSaveFiscalNote,
  } = useFiscalNoteForm();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const handlePhotoCaptured = (file: File) => {
    setPhoto(file);
    setIsCameraOpen(false);
  };

  return (
    <>
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
          <Button onClick={onStartScan}>
            <Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}
          </Button>
          <Button asChild variant="outline">
            <Label htmlFor="scan-file-input">
              <ImageIcon className="mr-2 h-4 w-4" /> {t('scan_from_image')}
              <Input id="scan-file-input" type="file" accept="image/*" className="hidden" onChange={onFileScan} />
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
                className={cn("w-full justify-start text-left font-normal", !arrivalDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {arrivalDate ? format(arrivalDate, "PPP") : <span>{t('pick_a_date')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={arrivalDate} onSelect={setArrivalDate} initialFocus />
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
            <img src={URL.createObjectURL(photo)} alt="Preview" className="w-24 h-24 object-cover rounded-md mt-2" />
          )}
        </div>
        <Button onClick={handleSaveFiscalNote} className="w-full" disabled={!nfeKey}>
          <FileText className="mr-2 h-4 w-4" /> {t('save_fiscal_note')}
        </Button>
      </div>
      {isCameraOpen && <CameraCapture onCapture={handlePhotoCaptured} onClose={() => setIsCameraOpen(false)} />}
    </>
  );
};

export default FiscalNoteForm;