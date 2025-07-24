import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, Upload, Download, Search, ArrowLeft, MoreHorizontal, Printer } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { exportToCsv } from '@/utils/export';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { parseCsv } from '@/utils/import';
import { MultiSelect } from '@/components/ui/multi-select';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { v4 as uuidv4 } from 'uuid';
import QRCode from '@/components/QRCodeWrapper';

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
  const [isBulkTagDialogOpen, setIsBulkTagDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);

  // State for Add/Edit Dialog
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [lowStock, setLowStock] = useState<number | ''>('');
  const [criticalStock, setCriticalStock] = useState<number | ''>('');
  const [itemType, setItemType] = useState('consumable');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: items, isLoading, error } = useQuery<Item[], Error>({
    queryKey: ['items', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('items').select('*').eq('user_id', user.id);
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
      } else {
        compareA = a.quantity;
        compareB = b.quantity;
      }
      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, sortBy, sortOrder]);

  const resetDialogState = () => {
    setName(''); setDescription(''); setQuantity(0); setBarcode('');
    setLowStock(''); setCriticalStock(''); setItemType('consumable');
    setSelectedTags([]); setImageFile(null); setImagePreview(null); setEditingItem(null);
  };

  const handleOpenAddDialog = () => { resetDialogState(); setIsAddDialogOpen(true); };

  const handleOpenEditDialog = (item: Item) => {
    resetDialogState(); setEditingItem(item); setName(item.name);
    setDescription(item.description || ''); setQuantity(item.quantity);
    setBarcode(item.barcode || ''); setLowStock(item.low_stock_threshold || '');
    setCriticalStock(item.critical_stock_threshold || '');
    if (item.is_ppe) setItemType('ppe'); else if (item.is_tool) setItemType('tool'); else setItemType('consumable');
    setSelectedTags(item.tags || []); setImagePreview(item.image_url); setIsEditDialogOpen(true);
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
    const { error: uploadError, data } = await supabase.storage.from('item-images').upload(fileName, file);
    if (uploadError) { showError(`${t('error_uploading_image')} ${uploadError.message}`); return null; }
    const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(data.path);
    return publicUrl;
  };

  const handleAddItem = async () => {
    if (!name || quantity < 0) { showError(t('fill_item_name_quantity')); return; }
    if (!user) { showError(t('user_not_authenticated_login')); return; }
    let imageUrl = null; if (imageFile) { imageUrl = await uploadImage(imageFile); }
    const { error } = await supabase.from('items').insert({
      name, description, quantity, barcode: barcode.trim() === '' ? null : barcode.trim(),
      low_stock_threshold: lowStock === '' ? null : Number(lowStock),
      critical_stock_threshold: criticalStock === '' ? null : Number(criticalStock),
      one_time_use: itemType === 'consumable', is_tool: itemType === 'tool', is_ppe: itemType === 'ppe',
      tags: selectedTags, image_url: imageUrl, user_id: user.id,
    });
    if (error) { showError(`${t('error_adding_item')} ${error.message}`); }
    else { showSuccess(t('item_added_successfully')); queryClient.invalidateQueries({ queryKey: ['items'] }); setIsAddDialogOpen(false); }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return; if (!name || quantity < 0) { showError(t('fill_item_name_quantity')); return; }
    let imageUrl = editingItem.image_url; if (imageFile) { imageUrl = await uploadImage(imageFile); }
    const { error } = await supabase.from('items').update({
      name, description, quantity, barcode: barcode.trim() === '' ? null : barcode.trim(),
      low_stock_threshold: lowStock === '' ? null : Number(lowStock),
      critical_stock_threshold: criticalStock === '' ? null : Number(criticalStock),
      one_time_use: itemType === 'consumable', is_tool: itemType === 'tool', is_ppe: itemType === 'ppe',
      tags: selectedTags, image_url: imageUrl,
    }).eq('id', editingItem.id);
    if (error) { showError(`${t('error_updating_item')} ${error.message}`); }
    else { showSuccess(t('item_updated_successfully')); queryClient.invalidateQueries({ queryKey: ['items'] }); setIsEditDialogOpen(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm(t('confirm_delete_item'))) {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) { showError(`${t('error_deleting_item')} ${error.message}`); }
      else { showSuccess(t('item_deleted_successfully')); queryClient.invalidateQueries({ queryKey: ['items'] }); }
    }
  };

  const handleExport = () => {
    if (!items || items.length === 0) { showError(t('no_data_to_export')); return; }
    try {
      const dataToExport = items.map(item => ({
        [t('name')]: item.name, [t('description')]: item.description, [t('quantity')]: item.quantity,
        [t('barcode')]: item.barcode, [t('type')]: item.is_ppe ? t('ppe') : item.is_tool ? t('tool') : t('consumable'),
        [t('tags')]: item.tags?.map(tagId => tags?.find(t => t.id === tagId)?.name).join('; ') || '',
      }));
      exportToCsv(dataToExport, 'inventory.csv'); showSuccess(t('inventory_exported_successfully'));
    } catch (err: any) { showError(`${t('error_exporting_inventory')} ${err.message}`); }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file || !user) return;
    const toastId = showLoading(t('importing'));
    try {
      const parsedData = await parseCsv<{ name: string; description?: string; quantity?: string; barcode?: string; low_stock_threshold?: string; critical_stock_threshold?: string; type?: string; }>(file);
      const itemsToImport = parsedData.map((row) => ({
        name: row.name, description: row.description, quantity: parseInt(row.quantity || '0', 10), barcode: row.barcode,
        low_stock_threshold: row.low_stock_threshold ? parseInt(row.low_stock_threshold, 10) : null,
        critical_stock_threshold: row.critical_stock_threshold ? parseInt(row.critical_stock_threshold, 10) : null,
        one_time_use: row.type?.toLowerCase() === 'consumable', is_tool: row.type?.toLowerCase() === 'tool', is_ppe: row.type?.toLowerCase() === 'ppe', user_id: user.id,
      }));
      const { error } = await supabase.from('items').insert(itemsToImport); if (error) { throw error; }
      dismissToast(toastId); showSuccess(t('items_imported_successfully', { count: itemsToImport.length }));
      queryClient.invalidateQueries({ queryKey: ['items'] }); setIsImportDialogOpen(false);
    } catch (error: any) { dismissToast(toastId); showError(`${t('error_importing_items')} ${error.message}`); }
  };

  const handlePrintBarcode = () => { window.print(); };

  const handleBulkDelete = async () => {
    const toastId = showLoading(t('deleting_items', { count: selectedItemIds.length }));
    const { error } = await supabase.from('items').delete().in('id', selectedItemIds);
    dismissToast(toastId);
    if (error) { showError(t('error_deleting_items') + error.message); }
    else { showSuccess(t('items_deleted_successfully')); setSelectedItemIds([]); queryClient.invalidateQueries({ queryKey: ['items'] }); }
    setIsBulkDeleteDialogOpen(false);
  };

  const handleBulkAddTags = async () => {
    if (tagsToAdd.length === 0) { showError(t('please_select_tags_to_add')); return; }
    const toastId = showLoading(t('adding_tags_to_items', { count: selectedItemIds.length }));
    const { data: itemsToUpdate, error: fetchError } = await supabase.from('items').select('*').in('id', selectedItemIds);
    if (fetchError) { dismissToast(toastId); showError(t('error_fetching_items_for_update')); return; }
    const updates = itemsToUpdate.map(item => ({
      ...item,
      tags: [...new Set([...(item.tags || []), ...tagsToAdd])]
    }));
    const { error: updateError } = await supabase.from('items').upsert(updates);
    dismissToast(toastId);
    if (updateError) { showError(t('error_updating_tags') + updateError.message); }
    else { showSuccess(t('tags_added_successfully')); setSelectedItemIds([]); setTagsToAdd([]); queryClient.invalidateQueries({ queryKey: ['items'] }); }
    setIsBulkTagDialogOpen(false);
  };

  const renderItemDialog = (isEditMode: boolean) => (
    <Dialog open={isEditMode ? isEditDialogOpen : isAddDialogOpen} onOpenChange={isEditMode ? setIsEditDialogOpen : setIsAddDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader><DialogTitle>{isEditMode ? t('edit_item') : t('add_new_item')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
          {/* Form fields */}
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">{t('name')}</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="description" className="text-right">{t('description')}</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="quantity" className="text-right">{t('quantity')}</Label><Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="lowStock" className="text-right">{t('low_stock_yellow')}</Label><Input id="lowStock" type="number" value={lowStock} onChange={(e) => setLowStock(e.target.value === '' ? '' : Number(e.target.value))} className="col-span-3" placeholder="e.g., 10" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="criticalStock" className="text-right">{t('critical_stock_red')}</Label><Input id="criticalStock" type="number" value={criticalStock} onChange={(e) => setCriticalStock(e.target.value === '' ? '' : Number(e.target.value))} className="col-span-3" placeholder="e.g., 5" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="tags" className="text-right">{t('tags')}</Label><MultiSelect options={tagOptions} selected={selectedTags} onChange={setSelectedTags} className="col-span-3" placeholder={t('select_tags')} /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">{t('type')}</Label><RadioGroup value={itemType} onValueChange={setItemType} className="col-span-3 flex space-x-4"><div className="flex items-center space-x-2"><RadioGroupItem value="consumable" id="r1" /><Label htmlFor="r1">{t('consumable')}</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="tool" id="r2" /><Label htmlFor="r2">{t('tool')}</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="ppe" id="r3" /><Label htmlFor="r3">{t('ppe')}</Label></div></RadioGroup></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="image" className="text-right">{t('image')}</Label><div className="col-span-3"><Input id="image" type="file" accept="image/*" onChange={handleImageChange} />{imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 h-24 w-24 object-cover" />}</div></div>
          {/* Barcode Generation */}
          <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="barcode" className="text-right">{t('barcode')}</Label><div className="col-span-3 flex items-center gap-2"><Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} /><Button type="button" variant="outline" onClick={() => setBarcode(uuidv4())}>{t('generate')}</Button></div></div>
          {barcode && (<div className="col-span-4 flex flex-col items-center gap-4 printable"><p className="font-semibold">{name}</p><QRCode value={barcode} size={128} /><Button type="button" variant="outline" size="sm" className="mt-2 no-print" onClick={handlePrintBarcode}><Printer className="mr-2 h-4 w-4" />{t('print_barcode')}</Button></div>)}
        </div>
        <DialogFooter><Button onClick={isEditMode ? handleUpdateItem : handleAddItem}>{isEditMode ? t('save_changes') : t('add_new_item')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4">
      <Card>
        <CardHeader><div className="flex items-center justify-between mb-4"><Button variant="outline" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button><div className="flex-grow text-center"><CardTitle>{t('inventory_management_title')}</CardTitle><CardDescription>{t('manage_warehouse_items')}</CardDescription></div><div className="w-10" /></div></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex flex-1 flex-col md:flex-row gap-2">
              <div className="relative flex-1 md:flex-initial"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search_by_name_tag_desc')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full" /></div>
              <div className="flex gap-2"><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder={t('sort_by')} /></SelectTrigger><SelectContent><SelectItem value="name">{t('name')}</SelectItem><SelectItem value="quantity">{t('quantity')}</SelectItem></SelectContent></Select><Select value={sortOrder} onValueChange={setSortOrder}><SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder={t('order')} /></SelectTrigger><SelectContent><SelectItem value="asc">{t('ascending')}</SelectItem><SelectItem value="desc">{t('descending')}</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItemIds.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline">{t('bulk_actions')} ({selectedItemIds.length})</Button></DropdownMenuTrigger>
                  <DropdownMenuContent><DropdownMenuItem onSelect={() => setIsBulkTagDialogOpen(true)}>{t('add_tags_to_selected')}</DropdownMenuItem><DropdownMenuItem onSelect={() => setIsBulkDeleteDialogOpen(true)} className="text-destructive">{t('delete_selected')}</DropdownMenuItem></DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="flex-1 md:flex-initial"><Upload className="mr-2 h-4 w-4" /> {t('import_from_csv')}</Button>
              <Button onClick={handleExport} className="flex-1 md:flex-initial"><Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}</Button>
              <Button onClick={handleOpenAddDialog} className="flex-1 md:flex-initial"><PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_item')}</Button>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox checked={selectedItemIds.length === filteredAndSortedItems.length && filteredAndSortedItems.length > 0} onCheckedChange={(checked) => setSelectedItemIds(checked ? filteredAndSortedItems.map(i => i.id) : [])} /></TableHead><TableHead>{t('name')}</TableHead><TableHead>{t('description')}</TableHead><TableHead className="text-right">{t('quantity')}</TableHead><TableHead>{t('type')}</TableHead><TableHead>{t('tags')}</TableHead><TableHead>{t('actions')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredAndSortedItems.map((item) => (
                <TableRow key={item.id} data-state={selectedItemIds.includes(item.id) && "selected"}>
                  <TableCell><Checkbox checked={selectedItemIds.includes(item.id)} onCheckedChange={(checked) => setSelectedItemIds(prev => checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} /></TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.critical_stock_threshold != null && item.quantity <= item.critical_stock_threshold ? (<Badge variant="destructive">{item.quantity}</Badge>) : item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold ? (<Badge variant="secondary" className="bg-yellow-400 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-200">{item.quantity}</Badge>) : (<Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">{item.quantity}</Badge>)}</TableCell>
                  <TableCell>{item.is_ppe ? (<Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('ppe')}</Badge>) : item.is_tool ? (<Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{t('tool')}</Badge>) : (<Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{t('consumable')}</Badge>)}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{item.tags?.map(tagId => { const tag = tags?.find(t => t.id === tagId); return tag ? <span key={tag.id} className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.name}</span> : null; })}</div></TableCell>
                  <TableCell><div className="flex gap-2"><Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {renderItemDialog(false)}
      {renderItemDialog(true)}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}><DialogContent><DialogHeader><DialogTitle>{t('import_inventory')}</DialogTitle></DialogHeader><p>{t('import_instructions_inventory')}</p><Input type="file" accept=".csv" onChange={handleImport} /></DialogContent></Dialog>
      <Dialog open={isBulkTagDialogOpen} onOpenChange={setIsBulkTagDialogOpen}><DialogContent><DialogHeader><DialogTitle>{t('add_tags_to_selected_items', { count: selectedItemIds.length })}</DialogTitle><DialogDescription>{t('select_tags_to_add_to_all_selected_items')}</DialogDescription></DialogHeader><div className="py-4"><MultiSelect options={tagOptions} selected={tagsToAdd} onChange={setTagsToAdd} placeholder={t('select_tags')} /></div><DialogFooter><Button variant="outline" onClick={() => setIsBulkTagDialogOpen(false)}>{t('cancel')}</Button><Button onClick={handleBulkAddTags}>{t('add_tags')}</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('confirm_bulk_delete_items', { count: selectedItemIds.length })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>{t('delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
};

export default Inventory;