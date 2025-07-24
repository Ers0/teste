import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Camera, Search, Package, Plus, Minus, PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Item } from '@/types';

interface ItemSelectionProps {
  scannedItem: Item | null;
  itemBarcodeInput: string;
  onItemBarcodeInputChange: (value: string) => void;
  onScanItem: () => void;
  onStartItemScan: () => void;
  itemSearchTerm: string;
  onItemSearchTermChange: (value: string) => void;
  onSearchItemByName: () => void;
  itemSearchResults: Item[];
  onSelectItem: (item: Item) => void;
  onClearItem: () => void;
  onAddItemToList: () => void;
  onOpenKitDialog: () => void;
  quantityToChange: number;
  onQuantityChange: (value: number) => void;
  incrementQuantity: () => void;
  decrementQuantity: () => void;
  transactionType: 'takeout' | 'return';
  isBroken: boolean;
  onIsBrokenChange: (value: boolean) => void;
  isRecipientSelected: boolean;
}

const ItemSelection: React.FC<ItemSelectionProps> = ({
  scannedItem, itemBarcodeInput, onItemBarcodeInputChange, onScanItem, onStartItemScan,
  itemSearchTerm, onItemSearchTermChange, onSearchItemByName, itemSearchResults,
  onSelectItem, onClearItem, onAddItemToList, onOpenKitDialog, quantityToChange,
  onQuantityChange, incrementQuantity, decrementQuantity, transactionType, isBroken, onIsBrokenChange,
  isRecipientSelected
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-b pb-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center">
          <Package className="mr-2 h-5 w-5" /> {t('item_information')}
        </h3>
        <Button variant="outline" size="sm" onClick={onOpenKitDialog} disabled={!isRecipientSelected}>
          <PackagePlus className="mr-2 h-4 w-4" /> {t('add_from_kit')}
        </Button>
      </div>
      {!scannedItem ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="text" placeholder={t('enter_item_barcode_manually')} value={itemBarcodeInput} onChange={(e) => onItemBarcodeInputChange(e.target.value)} className="flex-grow" />
            <Button onClick={onScanItem}><Search className="mr-2 h-4 w-4" /> {t('search_item_by_barcode')}</Button>
            <Button onClick={onStartItemScan}><Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}</Button>
          </div>
          <div className="text-center text-sm text-muted-foreground my-2">{t('or')}</div>
          <div className="flex items-center space-x-2">
            <Input type="text" placeholder={t('enter_item_name_to_search')} value={itemSearchTerm} onChange={(e) => onItemSearchTermChange(e.target.value)} className="flex-grow" />
            <Button onClick={onSearchItemByName}><Search className="mr-2 h-4 w-4" /> {t('search_item_by_name')}</Button>
          </div>
          {itemSearchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
              <p className="text-sm font-medium">{t('select_item_from_results')}:</p>
              {itemSearchResults.map((item) => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" onClick={() => onSelectItem(item)}>
                      {item.name} ({item.barcode || t('no_barcode')})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{item.description || t('no_description')}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="border p-3 rounded-md space-y-2 bg-gray-50 dark:bg-gray-800">
          <h4 className="text-md font-semibold">{scannedItem.name}</h4>
          <p><strong>{t('description')}:</strong> {scannedItem.description || 'N/A'}</p>
          <p><strong>{t('current_quantity')}:</strong> {scannedItem.quantity}</p>
          <p><strong>{t('barcode')}:</strong> {scannedItem.barcode}</p>
          {scannedItem.one_time_use && <p className="text-sm text-red-500 font-semibold">{t('this_is_one_time_use_item')}</p>}
          {scannedItem.is_tool && <p className="text-sm text-blue-500 font-semibold">{t('this_is_a_tool')}</p>}
          {scannedItem.requires_requisition && <Badge variant="destructive">{t('requires_requisition')}</Badge>}
          <div className="space-y-2 mt-4">
            <Label htmlFor="quantityToChange">{t('quantity_to_change', { type: transactionType === 'takeout' ? t('take') : t('return') })}:</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantityToChange <= 1}><Minus className="h-4 w-4" /></Button>
              <Input id="quantityToChange" type="number" value={quantityToChange} onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)} min="1" className="text-center" />
              <Button variant="outline" size="icon" onClick={incrementQuantity}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          {transactionType === 'return' && scannedItem.is_tool && (
            <div className="flex items-center space-x-2 mt-2">
              <Switch id="is-broken" checked={isBroken} onCheckedChange={onIsBrokenChange} />
              <Label htmlFor="is-broken">{t('mark_as_broken')}</Label>
            </div>
          )}
          <Button onClick={onAddItemToList} className="w-full mt-2">{t('add_item_to_list')}</Button>
          <Button variant="outline" size="sm" className="mt-2" onClick={onClearItem}>{t('change_item')}</Button>
        </div>
      )}
    </div>
  );
};

export default ItemSelection;