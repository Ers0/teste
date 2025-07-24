import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Item, Kit, KitItem as DbKitItem } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useOnlineStatus } from '@/hooks/use-online-status';

interface KitItem extends Item {
  quantity: number;
  kit_item_id?: string;
}

interface PopulatedKit extends Kit {
  kit_items: KitItem[];
}

const Kits = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<PopulatedKit | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, KitItem>>(new Map());
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);

  const kits = useLiveQuery(() => db.kits.toArray(), []);
  const allKitItems = useLiveQuery(() => db.kit_items.toArray(), []);
  const allItems = useLiveQuery(() => db.items.toArray(), []);
  const isLoading = kits === undefined || allKitItems === undefined || allItems === undefined;

  const populatedKits = useMemo<PopulatedKit[]>(() => {
    if (!kits || !allKitItems || !allItems) return [];
    const itemsMap = new Map(allItems.map(item => [item.id, item]));
    return kits.map(kit => {
      const kitItemsForThisKit = allKitItems
        .filter(ki => ki.kit_id === kit.id)
        .map(ki => {
          const itemDetails = itemsMap.get(ki.item_id);
          return itemDetails ? { ...itemDetails, quantity: ki.quantity } : null;
        })
        .filter((i): i is KitItem => i !== null);
      return { ...kit, kit_items: kitItemsForThisKit };
    });
  }, [kits, allKitItems, allItems]);

  const openDialog = (kit: PopulatedKit | null = null) => {
    if (kit) {
      setEditingKit(kit);
      setKitName(kit.name);
      setKitDescription(kit.description || '');
      const itemsMap = new Map<string, KitItem>();
      kit.kit_items.forEach(ki => {
        itemsMap.set(ki.id, { ...ki });
      });
      setSelectedItems(itemsMap);
    } else {
      setEditingKit(null);
      setKitName('');
      setKitDescription('');
      setSelectedItems(new Map());
    }
    setIsDialogOpen(true);
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(item.id)) {
        newMap.set(item.id, { ...item, quantity: 1 });
      }
      return newMap;
    });
    setIsItemSearchOpen(false);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(itemId);
      if (item) {
        newMap.set(itemId, { ...item, quantity: Math.max(1, quantity) });
      }
      return newMap;
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
  };

  const handleSubmit = async () => {
    if (!isOnline) {
      showError(t('offline_action_error'));
      return;
    }
    if (!kitName.trim()) {
      showError(t('kit_name_required'));
      return;
    }
    if (selectedItems.size === 0) {
      showError(t('kit_must_have_item'));
      return;
    }

    const toastId = showLoading(editingKit ? t('updating_kit') : t('creating_kit'));
    try {
      let kitId = editingKit?.id;

      if (editingKit) {
        const { error } = await supabase.from('kits').update({ name: kitName, description: kitDescription }).eq('id', editingKit.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('kits').insert({ name: kitName, description: kitDescription, user_id: user!.id }).select('id').single();
        if (error) throw error;
        kitId = data.id;
      }

      if (!kitId) throw new Error('Failed to get kit ID.');

      const { error: deleteError } = await supabase.from('kit_items').delete().eq('kit_id', kitId);
      if (deleteError) throw deleteError;

      const itemsToInsert = Array.from(selectedItems.values()).map(item => ({
        kit_id: kitId,
        item_id: item.id,
        quantity: item.quantity,
        user_id: user!.id,
      }));

      const { error: insertError } = await supabase.from('kit_items').insert(itemsToInsert);
      if (insertError) throw insertError;

      dismissToast(toastId);
      showSuccess(t('kit_saved_successfully', { kitName }));
      setIsDialogOpen(false);
    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message);
    }
  };

  const handleDeleteKit = async (kitId: string) => {
    if (!isOnline) {
      showError(t('offline_action_error'));
      return;
    }
    if (window.confirm(t('confirm_delete_kit'))) {
      const { error } = await supabase.from('kits').delete().eq('id', kitId);
      if (error) {
        showError(error.message);
      } else {
        showSuccess(t('kit_deleted_successfully'));
      }
    }
  };

  const selectedItemsArray = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('manage_kits_title')}</CardTitle>
              <CardDescription>{t('manage_kits_description')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('create_new_kit')}
            </Button>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <p>{t('loading_kits')}</p>
            ) : populatedKits && populatedKits.length > 0 ? (
              populatedKits.map(kit => (
                <Card key={kit.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{kit.name}</CardTitle>
                      <CardDescription>{kit.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openDialog(kit)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteKit(kit.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {kit.kit_items.map(ki => (
                        <li key={ki.id}>{ki.name} <Badge variant="secondary">x{ki.quantity}</Badge></li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground">{t('no_kits_created')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingKit ? t('edit_kit') : t('create_new_kit')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kit-name">{t('kit_name')}</Label>
              <Input id="kit-name" value={kitName} onChange={(e) => setKitName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kit-description">{t('description_optional')}</Label>
              <Input id="kit-description" value={kitDescription} onChange={(e) => setKitDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('items_in_kit')}</Label>
              <Popover open={isItemSearchOpen} onOpenChange={setIsItemSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_item')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('search_for_item')} />
                    <CommandList>
                      <CommandEmpty>{t('no_items_found')}</CommandEmpty>
                      <CommandGroup>
                        {allItems?.map(item => (
                          <CommandItem key={item.id} onSelect={() => handleSelectItem(item)}>
                            {item.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
              {selectedItemsArray.length > 0 ? selectedItemsArray.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent">
                  <span className="font-medium">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`qty-${item.id}`} className="text-sm">{t('qty')}</Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value, 10))}
                      className="h-8 w-16"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveItem(item.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) : <p className="text-sm text-center text-muted-foreground py-4">{t('no_items_added_to_kit')}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSubmit}>{t('save_kit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kits;