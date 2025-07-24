import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Item } from '@/types';

interface TransactionItem {
  item: Item;
  quantity: number;
  type: 'takeout' | 'return';
  is_broken?: boolean;
}

interface TransactionListProps {
  items: TransactionItem[];
  onRemoveItem: (index: number) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ items, onRemoveItem }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="text-lg font-semibold">{t('transaction_list')}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_items_added_yet')}</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.map((txItem, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
              <div>
                <p className="font-medium">{txItem.item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t(txItem.type)}: {txItem.quantity}
                  {txItem.is_broken && <Badge variant="destructive" className="ml-2">{t('broken')}</Badge>}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemoveItem(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionList;