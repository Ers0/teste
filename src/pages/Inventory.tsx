import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, Upload, Download, Search, ArrowLeft } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { exportToCsv } from '@/utils/export';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { MultiSelect } from '@/components/ui/multi-select';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Item {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  barcode: string | null;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
  one_time_use: boolean;
  is_tool: boolean;
  is_ppe: boolean;
  image_url: string | null;
  user_id: string;
  tags: string[] | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

const Inventory = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // State for Add/Edit Dialog
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [lowStock, setLowStock] = useState<number | ''>('');
  const [criticalStock, setCriticalStock] = useState<number | ''>('');
  const [itemType, setItemType] = useState('consumable'); // 'consumable', 'tool', 'ppe'
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: items, isLoading, error } = useQuery<Item[], Error>({
    queryKey: ['items', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data as Item[];
    },
    enabled: !!user,
  });

  const { data: tags } = useQuery<Tag[], Error>({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('tags').select('*').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const tagOptions = useMemo(() => tags?.map(tag => ({ value: tag.id, label: tag.name })) || [], [tags]);

  const filteredAndSortedItems = useMemo(() => {
    if (!items) return [];
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let compareA, compareB;
      if (sortBy === 'name') {
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
      } else { // quantity
        compareA = a.quantity;
        compareB = b.quantity;
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, sortBy, sortOrder]);

  const resetDialogState = () => {
    setName('');
    setDescription('');
    setQuantity(0);
    setBarcode('');
    setLowStock('');
    setCriticalStock('');
    setItemType('consumable');
    setSelectedTags([]);
    setImageFile(null);
    setImagePreview(null);
    setEditingItem(null);
  };

  const handleOpenAddDialog = () => {
    resetDialogState();
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (item: Item) => {
    resetDialogState();
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setQuantity(item.quantity);
    setBarcode(item.barcode || '');
    setLowStock(item.low_stock_threshold || '');
    setCriticalStock(item.critical_stock_threshold || '');
    if (item.is_ppe) {
      setItemType('ppe');
    } else if (item.is_tool) {
      setItemType('tool');
    } else {
      setItemType('consumable');
    }
    setSelectedTags(item.tags || []);
    setImagePreview(item.image_url);
    setIsEditDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError, data } = await supabase.storage
      .from('item-images')
      .upload(fileName, file);

    if (uploadError) {
      showError(`${t('error_uploading_image')} ${uploadError.message}`);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(data.path);
    return publicUrl;
  };

  const handleAddItem = async () => {
    if (!name || quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let imageUrl = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const { error } = await supabase.from('items').insert({
      name,
      description,
      quantity,
      barcode,
      low_stock_threshold: lowStock === '' ? null : Number(lowStock),
      critical_stock_threshold: criticalStock === '' ? null : Number(criticalStock),
      one_time_use: itemType === 'consumable',
      is_tool: itemType === 'tool',
      is_ppe: itemType === 'ppe',
      tags: selectedTags,
      image_url: imageUrl,
      user_id: user.id,
    });

    if (error) {
      showError(`${t('error_adding_item')} ${error.message}`);
    } else {
      showSuccess(t('item_added_successfully'));
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsAddDialogOpen(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    if (!name || quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }

    let imageUrl = editingItem.image_url;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const { error } = await supabase
      .from('items')
      .update({
        name,
        description,
        quantity,
        barcode,
        low_stock_threshold: lowStock === '' ? null : Number(lowStock),
        critical_stock_threshold: criticalStock === '' ? null : Number(criticalStock),
        one_time_use: itemType === 'consumable',
        is_tool: itemType === 'tool',
        is_ppe: itemType === 'ppe',
        tags: selectedTags,
        image_url: imageUrl,
      })
      .eq('id', editingItem.id);

    if (error) {
      showError(`${t('error_updating_item')} ${error.message}`);
    } else {
      showSuccess(t('item_updated_successfully'));
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm(t('confirm_delete_item'))) {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) {
        showError(`${t('error_deleting_item')} ${error.message}`);
      } else {
        showSuccess(t('item_deleted_successfully'));
        queryClient.invalidateQueries({ queryKey: ['items'] });
      }
    }
  };

  const handleExport = () => {
    if (!items || items.length === 0) {
      showError(t('no_data_to_export'));
      return;
    }
    try {
      const dataToExport = items.map(item => ({
        [t('name')]: item.name,
        [t('description')]: item.description,
        [t('quantity')]: item.quantity,
        [t('barcode')]: item.barcode,
        [t('type')]: item.is_ppe ? t('ppe') : item.is_tool ? t('tool') : t('consumable'),
        [t('tags')]: item.tags?.map(tagId => tags?.find(t => t.id === tagId)?.name).join('; ') || '',
      }));
      exportToCsv(dataToExport, 'inventory.csv');
      showSuccess(t('inventory_exported_successfully'));
    } catch (err) {
      showError(`${t('error_exporting_inventory')} ${err.message}`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const itemsToImport = results.data.map((row: any) => ({
          name: row.name,
          description: row.description,
          quantity: parseInt(row.quantity, 10) || 0,
          barcode: row.barcode,
          low_stock_threshold: parseInt(row.low_stock_threshold, 10) || null,
          critical_stock_threshold: parseInt(row.critical_stock_threshold, 10) || null,
          one_time_use: row.type?.toLowerCase() === 'material',
          is_tool: row.type?.toLowerCase() === 'tool',
          is_ppe: row.type?.toLowerCase() === 'ppe',
          user_id: user.id,
        }));

        const { error } = await supabase.from('items').insert(itemsToImport);
        if (error) {
          showError(`${t('error_importing_items')} ${error.message}`);
        } else {
          showSuccess(t('items_imported_successfully', { count: itemsToImport.length }));
          queryClient.invalidateQueries({ queryKey: ['items'] });
          setIsImportDialogOpen(false);
        }
      },
      error: (error) => {
        showError(`${t('error_importing_items')} ${error.message}`);
      },
    });
  };

  const renderItemDialog = (isEditMode: boolean) => (
    <Dialog open={isEditMode ? isEditDialogOpen : isAddDialogOpen} onOpenChange={isEditMode ? setIsEditDialogOpen : setIsAddDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('edit_item') : t('add_new_item')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">{t('name')}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">{t('description')}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">{t('quantity')}</Label>
            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lowStock" className="text-right">{t('low_stock_yellow')}</Label>
            <Input id="lowStock" type="number" value={lowStock} onChange={(e) => setLowStock(e.target.value === '' ? '' : Number(e.target.value))} className="col-span-3" placeholder="e.g., 10" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="criticalStock" className="text-right">{t('critical_stock_red')}</Label>
            <Input id="criticalStock" type="number" value={criticalStock} onChange={(e) => setCriticalStock(e.target.value === '' ? '' : Number(e.target.value))} className="col-span-3" placeholder="e.g., 5" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="barcode" className="text-right">{t('barcode')}</Label>
            <Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">{t('tags')}</Label>
            <MultiSelect
              options={tagOptions}
              selected={selectedTags}
              onChange={setSelectedTags}
              className="col-span-3"
              placeholder={t('select_tags')}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t('type')}</Label>
            <RadioGroup value={itemType} onValueChange={setItemType} className="col-span-3 flex space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="consumable" id="r1" />
                <Label htmlFor="r1">{t('consumable')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tool" id="r2" />
                <Label htmlFor="r2">{t('tool')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ppe" id="r3" />
                <Label htmlFor="r3">{t('ppe')}</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right">{t('image')}</Label>
            <div className="col-span-3">
              <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 h-24 w-24 object-cover" />}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={isEditMode ? handleUpdateItem : handleAddItem}>{isEditMode ? t('save_changes') : t('add_new_item')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle>{t('inventory_management_title')}</CardTitle>
              <CardDescription>{t('manage_warehouse_items')}</CardDescription>
            </div>
            <div className="w-10"></div> {/* Spacer */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_by_name_tag_desc')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('sort_by')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('name')}</SelectItem>
                <SelectItem value="quantity">{t('quantity')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('order')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{t('ascending')}</SelectItem>
                <SelectItem value="desc">{t('descending')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => setIsImportDialogOpen(true)} variant="outline"><Upload className="mr-2 h-4 w-4" /> {t('import_from_csv')}</Button>
              <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}</Button>
              <Button onClick={handleOpenAddDialog}><PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_item')}</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead className="text-right">{t('quantity')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('tags')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">
                    {item.critical_stock_threshold != null && item.quantity <= item.critical_stock_threshold ? (
                      <Badge variant="destructive">{item.quantity}</Badge>
                    ) : item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold ? (
                      <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-200">{item.quantity}</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">{item.quantity}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.is_ppe ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('ppe')}</Badge>
                    ) : item.is_tool ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{t('tool')}</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{t('consumable')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.tags?.map(tagId => {
                        const tag = tags?.find(t => t.id === tagId);
                        return tag ? <span key={tag.id} className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</span> : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {renderItemDialog(false)}
      {renderItemDialog(true)}

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('import_inventory')}</DialogTitle>
          </DialogHeader>
          <p>{t('import_instructions_inventory')}</p>
          <Input type="file" accept=".csv" onChange={handleImport} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;