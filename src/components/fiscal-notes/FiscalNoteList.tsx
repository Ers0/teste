import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { FiscalNote } from '@/types';

interface FiscalNoteListProps {
  fiscalNotes: FiscalNote[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onViewImage: (url: string) => void;
}

const FiscalNoteList: React.FC<FiscalNoteListProps> = ({ fiscalNotes, isLoading, onDelete, onViewImage }) => {
  const { t } = useTranslation();

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  return (
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
                      onClick={() => onViewImage(note.photo_url!)}
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
                    <Button variant="destructive" size="icon" onClick={() => onDelete(note.id)}>
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
  );
};

export default FiscalNoteList;