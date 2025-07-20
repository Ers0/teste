import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { Barcode, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ScanItem = () => {
  const [barcode, setBarcode] = useState('');
  const [item, setItem] = useState<any>(null);
  const [quantityChange, setQuantityChange] = useState(0);

  const handleScan = async () => {
    if (!barcode) {
      showError('Please enter a barcode to scan.');
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('barcode', barcode)
      .single();

    if (error) {
      showError('Item not found or error fetching item: ' + error.message);
      setItem(null);
    } else {
      setItem(data);
      showSuccess(`Item "${data.name}" found!`);
    }
  };

  const handleQuantityUpdate = async (type: 'add' | 'remove') => {
    if (!item) {
      showError('No item selected to update.');
      return;
    }
    if (quantityChange <= 0) {
      showError('Quantity change must be greater than zero.');
      return;
    }

    let newQuantity = item.quantity;
    if (type === 'add') {
      newQuantity += quantityChange;
    } else {
      if (item.quantity < quantityChange) {
        showError('Cannot remove more items than available quantity.');
        return;
      }
      newQuantity -= quantityChange;
    }

    const { error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', item.id);

    if (error) {
      showError('Error updating quantity: ' + error.message);
    } else {
      showSuccess(`Quantity updated successfully! New quantity: ${newQuantity}`);
      setItem({ ...item, quantity: newQuantity });
      setQuantityChange(0);
      setBarcode(''); // Clear barcode after successful update
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Scan Item</CardTitle>
          <CardDescription>Scan an item to add or remove quantity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Enter barcode or scan"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleScan}>
              <Barcode className="mr-2 h-4 w-4" /> Scan
            </Button>
          </div>

          {item && (
            <div className="border p-4 rounded-md space-y-2">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p><strong>Description:</strong> {item.description || 'N/A'}</p>
              <p><strong>Current Quantity:</strong> {item.quantity}</p>
              <p><strong>Barcode:</strong> {item.barcode}</p>

              <div className="space-y-2 mt-4">
                <Label htmlFor="quantityChange">Change Quantity By:</Label>
                <Input
                  id="quantityChange"
                  type="number"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(parseInt(e.target.value) || 0)}
                  min="0"
                />
                <div className="flex gap-2">
                  <Button onClick={() => handleQuantityUpdate('add')} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" /> Add
                  </Button>
                  <Button onClick={() => handleQuantityUpdate('remove')} variant="destructive" className="flex-1">
                    <Minus className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanItem;