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
  tags: string[] | null;
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
  tags: '',
};

const Inventory = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState(initialNewItemState);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'quantity' | 'movement'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user, sortKey, sortDirection, searchTerm]);

  const fetchItems = async () => {
    if (!user) return;

    let query = supabase
      .from('items')
      .select('*, low_stock_threshold, critical_stock_threshold, one_time_use, is_tool, tags')
      .eq('user_id', user.id);

    if (searchTerm) {
      const searchTerms = searchTerm.trim().split(/[\s,]+/).filter(Boolean);
      if (searchTerms.length > 0) {
        const orFilters = [
          ...searchTerms.map(term => `name.ilike.%${term}%`),
          ...searchTerms.map(term => `description.ilike.%${term}%`),
          `tags.cs.{${searchTerms.join(',')}}`
        ].join(',');
        query = query.or(orFilters);
      }
    }

    let data: Item[] | null = null;
    let error: any = null;

    if (sortKey === 'movement') {
      const { data: itemsData, error: itemsError } = await query;

      if (itemsError) {
        showError(t('error_fetching_items') + itemsError.message);
        return;
      }

      const itemIds = itemsData.map(item => item.id);

      const { data: movementData, error: movementError } = await supabase
        .from('item_movement_counts')
        .select('*')
        .in('item_id', itemIds);

      if (movementError) {
        showError(t('error_fetching_item_movement_counts') + movementError.message);
        return;
      }

      const itemsWithMovement = itemsData.map(item => {
        const movement = movementData.find(m => m.item_id === item.id);
        return {
          ...item,
          total_movement: movement ? movement.total_movement : 0
        };
      });

      itemsWithMovement.sort((a, b) => {
        if (sortDirection === 'asc') {
          return (a as any).total_movement - (b as any).total_movement;
        } else {
          return (b as any).total_movement - (a as any).total_movement;
        }
      });
      data = itemsWithMovement;

    } else {
      query = query.order(sortKey, { ascending: sortDirection === 'asc' });
      const { data: directData, error: directError } = await query;
      data = directData;
      error = directError;
    }

    if (error) {
      showError(t('error_fetching_items') + error.message);
    } else {
      setItems(data || []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsedValue = name === 'quantity' || name === 'low_stock_threshold' || name === 'critical_stock_threshold' ? parseInt(value, 10) || 0 : value;

    if (editingItem) {
      setEditingItem({ ...editingItem, [name]: parsedValue });
    } else {
      setNewItem({ ...newItem, [name]: parsedValue });
    }
  };

  const handleToggleChange = (checked: boolean) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, one_time_use: checked, is_tool: checked ? false : editingItem.is_tool });
    } else {
      setNewItem({ ...newItem, one_time_use: checked, is_tool: checked ? false : newItem.is_tool });
    }
  };

  const handleIsToolToggleChange = (checked: boolean) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, is_tool: checked, one_time_use: checked ? false : editingItem.one_time_use });
    } else {
      setNewItem({ ...newItem, is_tool: checked, one_time_use: checked ? false : newItem.is_tool });
    }
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

    const { error: uploadError } = await supabase.storage
      .from('inventory-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      showError(t('error_uploading_image') + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddItem = async () => {
    if (!newItem.name || newItem.quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const tagsArray = newItem.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const { data: insertedItem, error: insertError } = await supabase
      .from('items')
      .insert([{ 
        name: newItem.name, 
        description: newItem.description, 
        barcode: newItem.barcode, 
        quantity: newItem.quantity,
        low_stock_threshold: newItem.low_stock_threshold,
        critical_stock_threshold: newItem.critical_stock_threshold,
        one_time_use: newItem.one_time_use,
        is_tool: newItem.is_tool,
        user_id: user.id,
        tags: tagsArray,
      }])
      .select()
      .single();

    if (insertError) {
      showError(t('error_adding_item') + insertError.message);
      return;
    }

    let imageUrl = null;
    if (newItem.image && insertedItem) {
      imageUrl = await uploadImage(newItem.image, insertedItem.id);
      if (imageUrl) {
        await supabase.from('items').update({ image_url: imageUrl }).eq('id', insertedItem.id);
      }
    }

    showSuccess(t('item_added_successfully'));
    setNewItem(initialNewItemState);
    setIsDialogOpen(false);
    fetchItems();
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.name || editingItem.quantity < 0) {
      showError(t('fill_item_name_quantity'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let imageUrl = editingItem.image_url;
    if (editingItem.image instanceof File) {
      imageUrl = await uploadImage(editingItem.image, editingItem.id);
    }

    const currentTags = (editingItem.tags as unknown as string) || '';
    const tagsArray = currentTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const { error } = await supabase
      .from('items')
      .update({
        name: editingItem.name,
        description: editingItem.description,
        barcode: editingItem.barcode,
        quantity: editingItem.quantity,
        image_url: imageUrl,
        low_stock_threshold: editingItem.low_stock_threshold,
        critical_stock_threshold: editingItem.critical_stock_threshold,
        one_time_use: editingItem.one_time_use,
        is_tool: editingItem.is_tool,
        user_id: user.id,
        tags: tagsArray,
      })
      .eq('id', editingItem.id);

    if (error) {
      showError(t('error_updating_item') + error.message);
    } else {
      showSuccess(t('item_updated_successfully'));
      setEditingItem(null);
      setIsDialogOpen(false);
      fetchItems();
    }
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
    setEditingItem({
      ...item,
      tags: item.tags ? item.tags.join(', ') : '',
    } as any);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setNewItem(initialNewItemState);
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
      .select('name, description, barcode, quantity, low_stock_threshold, critical_stock_threshold, one_time_use, is_tool, tags')
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_exporting_inventory') + error.message);
      return;
    }
    if (!data || data.length === 0) {
      showError(t('no_data_to_export'));
      return;
    }

    const formattedData = data.map(item => ({
      ...item,
      tags: item.tags ? item.tags.join(';') : '', // Join tags with a semicolon for CSV
    }));

    exportToCsv(formattedData, 'inventory_report.csv');
    showSuccess(t('inventory_exported_successfully'));
  };

  const handleImport = async () => {
    if (!fileToImport || !user) {
      showError(t('no_file_selected'));
      return;
    }

    const toastId = showLoading(t('importing'));
    try {
      const parsedData = await parseCsv<any>(fileToImport);
      const itemsToImport = parsedData.map(row => ({
        user_id: user.id,
        name: row.name,
        description: row.description || null,
        barcode: row.barcode || null,
        quantity: parseInt(row.quantity, 10) || 0,
        low_stock_threshold: parseInt(row.low_stock_threshold, 10) || null,
        critical_stock_threshold: parseInt(row.critical_stock_threshold, 10) || null,
        one_time_use: ['true', '1', 'yes'].includes(row.one_time_use?.toLowerCase()),
        is_tool: ['true', '1', 'yes'].includes(row.is_tool?.toLowerCase()),
        tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : null,
      }));

      const { error } = await supabase.from('items').upsert(itemsToImport, { onConflict: 'user_id,name' });

      if (error) {
        throw error;
      }

      dismissToast(toastId);
      showSuccess(t('items_imported_successfully', { count: itemsToImport.length }));
      setIsImportDialogOpen(false);
      setFileToImport(null);
      fetchItems();
    } catch (error: any) {
      dismissToast(toastId);
      showError(t('error_importing_items') + error.message);
    }
  };

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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('search_by_name_tag_desc')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[250px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort-by">{t('sort_by')}</Label>
              <Select value={sortKey} onValueChange={(value: 'name' | 'quantity' | 'movement') => setSortKey(value)}>
                <SelectTrigger id="sort-by" className="w-[160px]">
                  <SelectValue placeholder={t('sort_by')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t('name')}</SelectItem>
                  <SelectItem value="quantity">{t('quantity')}</SelectItem>
                  <SelectItem value="movement">{t('most_movemented')}</SelectItem>
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
            <div className="flex items-center gap-2">
              <Link to="/scan-item">
                <Button variant="outline">
                  <Scan className="mr-2 h-4 w-4" /> {t('scan_item')}
                </Button>
              </Link>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingItem(null); setNewItem(initialNewItemState); setIsDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_item')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? t('edit_item') : t('add_new_item')}</DialogTitle>
                    <DialogDescription>
                      {editingItem ? t('make_changes_to_item') : t('add_new_item_to_inventory')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        {t('name')}
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        value={editingItem ? editingItem.name : newItem.name}
                        onChange={handleInputChange}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="description" className="text-right">
                        {t('description')}
                      </Label>
                      <Input
                        id="description"
                        name="description"
                        value={editingItem ? editingItem.description || '' : newItem.description}
                        onChange={handleInputChange}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tags" className="text-right">
                        {t('tags')}
                      </Label>
                      <Input
                        id="tags"
                        name="tags"
                        value={editingItem ? (editingItem as any).tags : newItem.tags}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder={t('comma_separated_tags')}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="barcode" className="text-right">
                        {t('barcode')}
                      </Label>
                      <Input
                        id="barcode"
                        name="barcode"
                        value={editingItem ? editingItem.barcode || '' : newItem.barcode}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder={t('enter_barcode_or_scan')}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        {t('quantity')}
                      </Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        value={String(editingItem ? editingItem.quantity : newItem.quantity)}
                        onChange={handleInputChange}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="low_stock_threshold" className="text-right">
                        {t('low_stock_yellow')}
                      </Label>
                      <Input
                        id="low_stock_threshold"
                        name="low_stock_threshold"
                        type="number"
                        value={String(editingItem ? editingItem.low_stock_threshold ?? 10 : newItem.low_stock_threshold)}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="critical_stock_threshold" className="text-right">
                        {t('critical_stock_red')}
                      </Label>
                      <Input
                        id="critical_stock_threshold"
                        name="critical_stock_threshold"
                        type="number"
                        value={String(editingItem ? editingItem.critical_stock_threshold ?? 5 : newItem.critical_stock_threshold)}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder="e.g., 5"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="one_time_use" className="text-right">
                        {t('one_time_use')}
                      </Label>
                      <Switch
                        id="one_time_use"
                        checked={editingItem ? editingItem.one_time_use : newItem.one_time_use}
                        onCheckedChange={handleToggleChange}
                        disabled={editingItem ? editingItem.is_tool : newItem.is_tool}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="is_tool" className="text-right">
                        {t('tool')}
                      </Label>
                      <Switch
                        id="is_tool"
                        checked={editingItem ? editingItem.is_tool : newItem.is_tool}
                        onCheckedChange={handleIsToolToggleChange}
                        disabled={editingItem ? editingItem.one_time_use : newItem.one_time_use}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="image" className="text-right">
                        {t('image')}
                      </Label>
                      <Input
                        id="image"
                        name="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="col-span-3"
                      />
                      {editingItem?.image_url && (
                        <img src={editingItem.image_url} alt={editingItem.name} className="col-span-4 w-24 h-24 object-cover rounded-md mt-2 mx-auto" />
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                    <Button onClick={editingItem ? handleUpdateItem : handleAddItem}>
                      {editingItem ? t('save_changes') : t('add_new_item')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> {t('import_from_csv')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('import_inventory')}</DialogTitle>
                    <DialogDescription>{t('import_instructions_inventory')}</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="csv-file">{t('upload_csv_file')}</Label>
                    <Input id="csv-file" type="file" accept=".csv" onChange={(e) => setFileToImport(e.target.files ? e.target.files[0] : null)} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>{t('cancel')}</Button>
                    <Button onClick={handleImport} disabled={!fileToImport}>{t('import')}</Button>
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
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                      {t('no_items_found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-500 text-xs">
                            {t('no_image')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.tags && item.tags.map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.is_tool ? (
                          <Badge variant="outline">{t('tool')}</Badge>
                        ) : item.one_time_use ? (
                          <Badge variant="secondary">{t('one_time_use')}</Badge>
                        ) : (
                          <Badge>{t('consumable')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.description || 'N/A'}</TableCell>
                      <TableCell>{item.barcode || 'N/A'}</TableCell>
                      <TableCell className={`text-right ${getQuantityColorClass(item)}`}>{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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