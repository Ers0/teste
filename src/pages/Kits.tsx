import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, ArrowLeft, PackagePlus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { Item, Kit, KitItem as DbKitItem } from '@/lib/db';

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
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<PopulatedKit | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, KitItem>>(new Map());
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);

  const { data: kits, isLoading: kitsLoading } = useOfflineQuery<Kit>(['kits', user?.id], 'kits', async () => {
    if (!user) return [];
    const { data, error } = await supabase.from('kits').select('*').eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return data;
  });

  const { data: allKitItems, isLoading: kitItemsLoading } = useOfflineQuery<DbKitItem>(['kit_items', user?.id], 'kit_items', async () => {
    if (!user) return [];
    const { data, error } = await supabase.from('kit_items').select('*').eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return data;
  });

  const { data: allItems, isLoading: itemsLoading } = useOfflineQuery<Item>(['items', user?.id], 'items', async () => {
    if (!user) return [];
    const { data, error } = await supabase.from('items').select('*').eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return data;
  });

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
    if (!kitName.trim()) {
      showError('Kit name is required.');
      return;
    }
    if (selectedItems.size === 0) {
      showError('A kit must have at least one item.');
      return;
    }

    const toastId = showLoading(editingKit ? 'Updating kit...' : 'Creating kit...');
    try {
      let kitId = editingKit?.id;

      if (editingKit) {
        const { error } = await supabase.from('kits').update({ name: kitName, description: kitDescription }).eq('id', editingKit.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('kits').insert({ name: kitName, description: kitDescription }).select('id').single();
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
      showSuccess(`Kit "${kitName}" saved successfully!`);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['kits', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['kit_items', user?.id] });
    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message);
    }
  };

  const handleDeleteKit = async (kitId: string) => {
    if (window.confirm('Are you sure you want to delete this kit? This action cannot be undone.')) {
      const { error } = await supabase.from('kits').delete().eq('id', kitId);
      if (error) {
        showError(error.message);
      } else {
        showSuccess('Kit deleted successfully.');
        queryClient.invalidateQueries({ queryKey: ['kits', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['kit_items', user?.id] });
      }
    }
  };

  const selectedItemsArray = useMemo(() => Array.from(selectedItems.values()), [selectedItems]);
  const isLoading = kitsLoading || kitItemsLoading || itemsLoading;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">Manage Kits</CardTitle>
              <CardDescription>Create and manage bundles of items for quick checkout.</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Kit
            </Button>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading kits...</p>
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
              <p className="text-center text-muted-foreground">No kits created yet. Get started by creating one!</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingKit ? 'Edit Kit' : 'Create New Kit'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kit-name">Kit Name</Label>
              <Input id="kit-name" value={kitName} onChange={(e) => setKitName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kit-description">Description (Optional)</Label>
              <Input id="kit-description" value={kitDescription} onChange={(e) => setKitDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Items in Kit</Label>
              <Popover open={isItemSearchOpen} onOpenChange={setIsItemSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search for an item..." />
                    <CommandList>
                      <CommandEmpty>No items found.</CommandEmpty>
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
                    <Label htmlFor={`qty-${item.id}`} className="text-sm">Qty:</Label>
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
              )) : <p className="text-sm text-center text-muted-foreground py-4">No items added to the kit yet.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kits;