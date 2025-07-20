import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // Import Table components
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, Scan, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  image_url: string | null;
  image?: File | null; // Added for temporary file storage
}

const Inventory = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', barcode: '', quantity: 0, image: null as File | null });
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('name', { ascending: true });
    if (error) {
      showError('Error fetching items: ' + error.message);
    } else {
      setItems(data);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingItem) {
      setEditingItem({ ...editingItem, [name]: value });
    } else {
      setNewItem({ ...newItem, [name]: value });
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
      showError('Error uploading image: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddItem = async () => {
    if (!newItem.name || newItem.quantity < 0) {
      showError('Please fill in item name and ensure quantity is not negative.');
      return;
    }

    const { data: insertedItem, error: insertError } = await supabase
      .from('items')
      .insert([{ name: newItem.name, description: newItem.description, barcode: newItem.barcode, quantity: newItem.quantity }])
      .select()
      .single();

    if (insertError) {
      showError('Error adding item: ' + insertError.message);
      return;
    }

    let imageUrl = null;
    if (newItem.image && insertedItem) {
      imageUrl = await uploadImage(newItem.image, insertedItem.id);
      if (imageUrl) {
        await supabase.from('items').update({ image_url: imageUrl }).eq('id', insertedItem.id);
      }
    }

    showSuccess('Item added successfully!');
    setNewItem({ name: '', description: '', barcode: '', quantity: 0, image: null });
    setIsDialogOpen(false);
    fetchItems();
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.name || editingItem.quantity < 0) {
      showError('Please fill in item name and ensure quantity is not negative.');
      return;
    }

    let imageUrl = editingItem.image_url;
    if (editingItem.image instanceof File) {
      imageUrl = await uploadImage(editingItem.image, editingItem.id);
    }

    const { error } = await supabase
      .from('items')
      .update({
        name: editingItem.name,
        description: editingItem.description,
        barcode: editingItem.barcode,
        quantity: editingItem.quantity,
        image_url: imageUrl,
      })
      .eq('id', editingItem.id);

    if (error) {
      showError('Error updating item: ' + error.message);
    } else {
      showSuccess('Item updated successfully!');
      setEditingItem(null);
      setIsDialogOpen(false);
      fetchItems();
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) {
        showError('Error deleting item: ' + error.message);
      } else {
        showSuccess('Item deleted successfully!');
        fetchItems();
      }
    }
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setNewItem({ name: '', description: '', barcode: '', quantity: 0, image: null });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">Inventory Management</CardTitle>
              <CardDescription>Manage your construction warehouse items.</CardDescription>
            </div>
            <div className="w-10"></div> {/* Placeholder for alignment */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end gap-2 mb-4">
            <Link to="/scan-item">
              <Button variant="outline">
                <Scan className="mr-2 h-4 w-4" /> Scan Item
              </Button>
            </Link>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingItem(null); setNewItem({ name: '', description: '', barcode: '', quantity: 0, image: null }); setIsDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? 'Make changes to the item here.' : 'Add a new item to your inventory.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
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
                      Description
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
                    <Label htmlFor="barcode" className="text-right">
                      Barcode
                    </Label>
                    <Input
                      id="barcode"
                      name="barcode"
                      value={editingItem ? editingItem.barcode || '' : newItem.barcode}
                      onChange={handleInputChange}
                      className="col-span-3"
                      placeholder="Enter barcode or scan"
                    />
                    <Button variant="outline" size="icon" className="col-span-1 ml-auto">
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity" className="text-right">
                      Quantity
                    </Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      value={editingItem ? editingItem.quantity : newItem.quantity}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="image" className="text-right">
                      Image
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
                      <img src={editingItem.image_url} alt="Item" className="col-span-4 w-24 h-24 object-cover rounded-md mt-2 mx-auto" />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button onClick={editingItem ? handleUpdateItem : handleAddItem}>
                    {editingItem ? 'Save Changes' : 'Add Item'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-x-auto"> {/* Added for horizontal scrolling on small screens */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      No items found. Add one above!
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
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || 'N/A'}</TableCell>
                      <TableCell>{item.barcode || 'N/A'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
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