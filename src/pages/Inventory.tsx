import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, Scan, ArrowLeft, Search, Download, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { exportToCsv } from '@/utils/export';
import { parseCsv } from '@/utils/import';
import MultiSelect, { Option } from '@/components/ui/MultiSelect';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  image_url: string | null;
  image?: File | null;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
  one_time_use: boolean;
  is_tool: boolean;
  user_id: string;
  tags: Tag[];
}

const initialNewItemState = {
  name: '',
  description: '',
  barcode: '',
  quantity: 0,
  image: null as File | null,
  low_stock_threshold: 10,
  critical_stock_threshold: 5,
  one_time_use: false,
  is_tool: false,
  tags: [] as string[],
};

const Inventory = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState(initialNewItemState);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'quantity' | 'movement'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const { data: availableTags = [] } = useQuery<Tag[], Error>({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('tags').select('*').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const tagOptions: Option[] = availableTags.map(tag => ({
    value: tag.id,
    label: tag.name,
    color: tag.color,
  }));

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user, sortKey, sortDirection, searchTerm]);

  const fetchItems = async () => {
    if (!user) return;
    let query = supabase
      .from('items')
      .select('*, tags(id, name, color)')
      .eq('user_id', user.id);

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    query = query.order(sortKey, { ascending: sortDirection === 'asc' });

    const { data, error } = await query;
    if (error) {
      showError(t('error_fetching_items') + error.message);
    } else {
      setItems(data as Item[] || []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsedValue = ['quantity', 'low_stock_threshold', 'critical_stock_threshold'].includes(name) ? parseInt(value, 10) || 0 : value;
    if (editingItem) {
      setEditingItem({ ...editingItem, [name]: parsedValue });
    } else {
      setNewItem({ ...newItem, [name]: parsedValue });
    }
  };

  const handleToggleChange = (checked: boolean, name: 'one_time_use' | 'is_tool') => {
    const stateUpdater = editingItem ? setEditingItem : setNewItem;
    const currentState = editingItem || newItem;
    stateUpdater(prev => ({
      ...prev!,
      [name]: checked,
      ...(name === 'one_time_use' && checked && { is_tool: false }),
      ...(name === 'is_tool' && checked && { one_time_use: false }),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (editingItem) {
        setEditingItem({ ...editingItem, image: e.target.files[0] });
      } else {
        setNewItem({ ...newItem, image: e.target.files[0] });
      }
    }
  };

  const uploadImage = async (file: File | null, itemId: string) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${itemId}.${fileExt}`;
    const filePath = `item_images/${fileName}`;
    const { error } = await supabase.storage.from('inventory-images').upload(filePath, file, { upsert: true });
    if (error) {
      showError(t('error_uploading_image') + error.message);
      return null;
    }
    const { data } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSaveItem = async () => {
    const isEditing = !!editingItem;
    const currentItem = isEditing ? editingItem : newItem;

    if (!currentItem.name || currentItem.quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const itemData = {
      name: currentItem.name,
      description: currentItem.description,
      barcode: currentItem.barcode,
      quantity: currentItem.quantity,
      low_stock_threshold: currentItem.low_stock_threshold,
      critical_stock_threshold: currentItem.critical_stock_threshold,
      one_time_use: currentItem.one_time_use,
      is_tool: currentItem.is_tool,
      user_id: user.id,
    };

    const { data: savedItem, error } = isEditing
      ? await supabase.from('items').update(itemData).eq('id', editingItem.id).select().single()
      : await supabase.from('items').insert(itemData).select().single();

    if (error) {
      showError((isEditing ? t('error_updating_item') : t('error_adding_item')) + error.message);
      return;
    }

    if (currentItem.image instanceof File) {
      const imageUrl = await uploadImage(currentItem.image, savedItem.id);
      if (imageUrl) {
        await supabase.from('items').update({ image_url: imageUrl }).eq('id', savedItem.id);
      }
    }

    await supabase.from('item_tags').delete().eq('item_id', savedItem.id);
    if (selectedTags.length > 0) {
      const tagsToInsert = selectedTags.map(tagId => ({
        item_id: savedItem.id,
        tag_id: tagId,
        user_id: user.id,
      }));
      const { error: tagsError } = await supabase.from('item_tags').insert(tagsToInsert);
      if (tagsError) {
        showError(t('error_saving_tags') + tagsError.message);
      }
    }

    showSuccess(isEditing ? t('item_updated_successfully') : t('item_added_successfully'));
    closeDialog();
    fetchItems();
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm(t('confirm_delete_item'))) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) {
        showError(t('error_deleting_item') + error.message);
      } else {
        showSuccess(t('item_deleted_successfully'));
        fetchItems();
      }
    }
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setSelectedTags(item.tags.map(tag => tag.id));
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingItem(null);
    setNewItem(initialNewItemState);
    setSelectedTags([]);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setNewItem(initialNewItemState);
    setSelectedTags([]);
  };

  const getQuantityColorClass = (item: Item) => {
    if (item.critical_stock_threshold !== null && item.quantity <= item.critical_stock_threshold) {
      return 'text-red-500 font-bold';
    }
    if (item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold) {
      return 'text-yellow-500 font-bold';
    }
    return 'text-green-500';
  };

  const handleExport = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('items')
      .select('name, description, barcode, quantity, low_stock_threshold, critical_stock_threshold, one_time_use, is_tool, tags(name)')
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_exporting_inventory') + error.message);
      return;
    }
    if (!data || data.length === 0) {
      showError(t('no_data_to_export'));
      return;
    }

    const formattedData = data.map((item: any) => ({
      ...item,
      tags: item.tags ? item.tags.map((t: any) => t.name).join(';') : '',
    }));

    exportToCsv(formattedData, 'inventory_report.csv');
    showSuccess(t('inventory_exported_successfully'));
  };

  const handleImport = async () => {
    // This function would need significant updates to handle tag mapping from names to IDs.
    // For now, it will import without tags.
    showError("Import functionality for items with tags is not yet implemented.");
  };

  const currentItemData = editingItem || newItem;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('inventory_management_title')}</CardTitle>
              <CardDescription>{t('manage_warehouse_items')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('search_by_name_tag_desc')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-[250px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="sort-by">{t('sort_by')}</Label>
              <Select value={sortKey} onValueChange={(value: 'name' | 'quantity' | 'movement') => setSortKey(value)}>
                <SelectTrigger id="sort-by" className="w-[160px]">
                  <SelectValue placeholder={t('sort_by')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t('name')}</SelectItem>
                  <SelectItem value="quantity">{t('quantity')}</SelectItem>
                </SelectContent>
              </Select>
              <Label htmlFor="sort-direction">{t('order')}</Label>
              <Select value={sortDirection} onValueChange={(value: 'asc' | 'desc') => setSortDirection(value)}>
                <SelectTrigger id="sort-direction" className="w-[140px]">
                  <SelectValue placeholder={t('order')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t('ascending')}</SelectItem>
                  <SelectItem value="desc">{t('descending')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <Link to="/scan-item">
                <Button variant="outline">
                  <Scan className="mr-2 h-4 w-4" /> {t('scan_item')}
                </Button>
              </Link>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_item')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? t('edit_item') : t('add_new_item')}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* Form fields */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">{t('name')}</Label>
                      <Input id="name" name="name" value={currentItemData.name} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="description" className="text-right">{t('description')}</Label>
                      <Input id="description" name="description" value={currentItemData.description || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tags" className="text-right">{t('tags')}</Label>
                      <MultiSelect
                        options={tagOptions}
                        selected={selectedTags}
                        onChange={setSelectedTags}
                        placeholder={t('select_tags')}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="barcode" className="text-right">{t('barcode')}</Label>
                      <Input id="barcode" name="barcode" value={currentItemData.barcode || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">{t('quantity')}</Label>
                      {/* @ts-ignore */}
                      <Input id="quantity" name="quantity" type="number" value={currentItemData.quantity} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="low_stock_threshold" className="text-right">{t('low_stock_yellow')}</Label>
                      {/* @ts-ignore */}
                      <Input id="low_stock_threshold" name="low_stock_threshold" type="number" value={currentItemData.low_stock_threshold || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="critical_stock_threshold" className="text-right">{t('critical_stock_red')}</Label>
                      {/* @ts-ignore */}
                      <Input id="critical_stock_threshold" name="critical_stock_threshold" type="number" value={currentItemData.critical_stock_threshold || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="one_time_use" className="text-right">{t('one_time_use')}</Label>
                      <Switch id="one_time_use" checked={currentItemData.one_time_use} onCheckedChange={(c) => handleToggleChange(c, 'one_time_use')} disabled={currentItemData.is_tool} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="is_tool" className="text-right">{t('tool')}</Label>
                      <Switch id="is_tool" checked={currentItemData.is_tool} onCheckedChange={(c) => handleToggleChange(c, 'is_tool')} disabled={currentItemData.one_time_use} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="image" className="text-right">{t('image')}</Label>
                      <Input id="image" name="image" type="file" accept="image/*" onChange={handleImageChange} className="col-span-3" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                    <Button onClick={handleSaveItem}>{editingItem ? t('save_changes') : t('add_new_item')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t('image')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('tags')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead>{t('barcode')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-center">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">{t('no_items_found')}</TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md" /> : <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-500 text-xs">{t('no_image')}</div>}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.tags && item.tags.map(tag => (
                            <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.is_tool ? <Badge variant="outline">{t('tool')}</Badge> : item.one_time_use ? <Badge variant="secondary">{t('one_time_use')}</Badge> : <Badge>{t('consumable')}</Badge>}
                      </TableCell>
                      <TableCell>{item.description || 'N/A'}</TableCell>
                      <TableCell>{item.barcode || 'N/A'}</TableCell>
                      <TableCell className={`text-right ${getQuantityColorClass(item)}`}>{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;