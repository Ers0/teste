import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { showSuccess, showError } from '@/utils/toast';
import { Tag } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const initialTagState = { name: '', color: '#842CD4' };

const Tags = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagData, setTagData] = useState(initialTagState);

  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []);
  const isLoading = tags === undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTagData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!tagData.name.trim()) {
      showError(t('tag_name_required'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    try {
      if (editingTag) {
        const updatedTag: Tag = {
          ...editingTag,
          name: tagData.name,
          color: tagData.color,
        };
        await db.tags.put(updatedTag);
        await db.outbox.add({ type: 'update', table: 'tags', payload: updatedTag, timestamp: Date.now() });
        showSuccess(t('tag_updated_locally'));
      } else {
        const newTag: Tag = {
          id: uuidv4(),
          user_id: user.id,
          name: tagData.name,
          color: tagData.color,
        };
        await db.tags.add(newTag);
        await db.outbox.add({ type: 'create', table: 'tags', payload: newTag, timestamp: Date.now() });
        showSuccess(t('tag_saved_locally'));
      }
      closeDialog();
    } catch (error: any) {
      showError(t('error_saving_tag') + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirm_delete_tag'))) {
      try {
        await db.tags.delete(id);
        await db.outbox.add({ type: 'delete', table: 'tags', payload: { id }, timestamp: Date.now() });
        showSuccess(t('tag_deleted_locally'));
      } catch (error: any) {
        showError(t('error_deleting_tag') + error.message);
      }
    }
  };

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag);
    setTagData({ name: tag.name, color: tag.color });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTag(null);
    setTagData(initialTagState);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTag(null);
    setTagData(initialTagState);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('manage_tags')}</CardTitle>
              <CardDescription>{t('create_edit_delete_tags')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={openAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_tag')}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{t('color')}</TableHead>
                <TableHead>{t('name')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center">{t('loading_tags')}</TableCell></TableRow>
              ) : tags && tags.length > 0 ? (
                tags.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: tag.color }}></div>
                    </TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(tag)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tag.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={3} className="text-center">{t('no_tags_found')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? t('edit_tag') : t('add_new_tag')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">{t('name')}</Label>
              <Input id="name" name="name" value={tagData.name} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="color" className="text-right">{t('color')}</Label>
              <Input id="color" name="color" type="color" value={tagData.color} onChange={handleInputChange} className="col-span-3 p-1 h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
            <Button onClick={handleSubmit}>{editingTag ? t('save_changes') : t('add_tag')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tags;