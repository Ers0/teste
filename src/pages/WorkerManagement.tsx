import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, QrCode, Upload, Download, Eye } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { exportToCsv } from '@/utils/export';
import Papa from 'papaparse';

interface Company {
  id: string;
  name: string;
}

interface PpeAssignment {
  itemId: string;
  itemName: string;
  quantity: number;
  dateAssigned: string;
}

interface Worker {
  id:string;
  name: string;
  company_id: string | null;
  external_qr_code_data: string | null;
  photo_url: string | null;
  company: { name: string } | null;
  assigned_ppes: PpeAssignment[] | null;
}

const WorkerManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPpeModalOpen, setIsPpeModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [selectedWorkerForPpe, setSelectedWorkerForPpe] = useState<Worker | null>(null);

  // State for Add/Edit Dialog
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [externalQr, setExternalQr] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: workers, isLoading, error } = useQuery<Worker[], Error>({
    queryKey: ['workers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('workers')
        .select('*, company:companies(name), assigned_ppes')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data as Worker[];
    },
    enabled: !!user,
  });

  const { data: companies } = useQuery<Company[], Error>({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('companies').select('*').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    return workers.filter(worker =>
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [workers, searchTerm]);

  const resetDialogState = () => {
    setName('');
    setCompanyId(null);
    setExternalQr('');
    setImageFile(null);
    setImagePreview(null);
    setEditingWorker(null);
  };

  const handleOpenAddDialog = () => {
    resetDialogState();
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (worker: Worker) => {
    resetDialogState();
    setEditingWorker(worker);
    setName(worker.name);
    setCompanyId(worker.company_id);
    setExternalQr(worker.external_qr_code_data || '');
    setImagePreview(worker.photo_url);
    setIsEditDialogOpen(true);
  };

  const handleViewQr = (worker: Worker) => {
    setEditingWorker(worker);
    setIsQrDialogOpen(true);
  };

  const handleViewPpes = (worker: Worker) => {
    setSelectedWorkerForPpe(worker);
    setIsPpeModalOpen(true);
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
    const fileName = `${user.id}/workers/${Date.now()}.${fileExt}`;
    const { error: uploadError, data } = await supabase.storage
      .from('worker-photos')
      .upload(fileName, file);

    if (uploadError) {
      showError(`${t('error_uploading_image')} ${uploadError.message}`);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('worker-photos').getPublicUrl(data.path);
    return publicUrl;
  };

  const handleAddWorker = async () => {
    if (!name) {
      showError(t('worker_name_required'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let photoUrl = null;
    if (imageFile) {
      photoUrl = await uploadImage(imageFile);
    }

    const { error } = await supabase.from('workers').insert({
      name,
      company_id: companyId,
      external_qr_code_data: externalQr || null,
      photo_url: photoUrl,
      user_id: user.id,
    });

    if (error) {
      showError(`${t('error_adding_worker')} ${error.message}`);
    } else {
      showSuccess(t('worker_added_successfully'));
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setIsAddDialogOpen(false);
    }
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker) return;
    if (!name) {
      showError(t('worker_name_required'));
      return;
    }

    let photoUrl = editingWorker.photo_url;
    if (imageFile) {
      photoUrl = await uploadImage(imageFile);
    }

    const { error } = await supabase
      .from('workers')
      .update({
        name,
        company_id: companyId,
        external_qr_code_data: externalQr || null,
        photo_url: photoUrl,
      })
      .eq('id', editingWorker.id);

    if (error) {
      showError(`${t('error_updating_worker')} ${error.message}`);
    } else {
      showSuccess(t('worker_updated_successfully'));
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (window.confirm(t('confirm_delete_worker'))) {
      const { error } = await supabase.from('workers').delete().eq('id', workerId);
      if (error) {
        showError(`${t('error_deleting_worker')} ${error.message}`);
      } else {
        showSuccess(t('worker_deleted_successfully'));
        queryClient.invalidateQueries({ queryKey: ['workers'] });
      }
    }
  };

  const handleExport = () => {
    if (!workers || workers.length === 0) {
      showError(t('no_data_to_export'));
      return;
    }
    try {
      const dataToExport = workers.map(worker => ({
        [t('name')]: worker.name,
        [t('company')]: worker.company?.name || t('uncategorized'),
        [t('external_qr_code')]: worker.external_qr_code_data,
      }));
      exportToCsv(dataToExport, 'workers.csv');
      showSuccess(t('workers_exported_successfully'));
    } catch (err) {
      showError(`${t('error_exporting_workers')} ${err.message}`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const workersToImport = results.data.map((row: any) => ({
          name: row.name,
          company_name: row.company, // We'll need to find company_id
          external_qr_code_data: row.external_qr_code_data,
          user_id: user.id,
        }));

        // This is a simplified import. A robust version would handle company creation/matching.
        const { error } = await supabase.from('workers').insert(workersToImport.map(w => ({...w, company_id: null})));
        if (error) {
          showError(`${t('error_importing_workers')} ${error.message}`);
        } else {
          showSuccess(t('workers_imported_successfully', { count: workersToImport.length }));
          queryClient.invalidateQueries({ queryKey: ['workers'] });
          setIsImportDialogOpen(false);
        }
      },
      error: (error) => {
        showError(`${t('error_importing_workers')} ${error.message}`);
      },
    });
  };

  const renderWorkerDialog = (isEditMode: boolean) => (
    <Dialog open={isEditMode ? isEditDialogOpen : isAddDialogOpen} onOpenChange={isEditMode ? setIsEditDialogOpen : setIsAddDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('edit_worker') : t('add_new_worker')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">{t('name')}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="company" className="text-right">{t('company')}</Label>
            <Select value={companyId || ''} onValueChange={(value) => setCompanyId(value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={t('select_a_company')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('no_company')}</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="externalQr" className="text-right">{t('external_qr_code')}</Label>
            <Input id="externalQr" value={externalQr} onChange={(e) => setExternalQr(e.target.value)} className="col-span-3" placeholder={t('optional_pre_existing_qr')} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right">{t('worker_photo')}</Label>
            <div className="col-span-3">
              <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded-full" />}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={isEditMode ? handleUpdateWorker : handleAddWorker}>{isEditMode ? t('save_changes') : t('add_worker')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const PpeDetailsModal = ({ worker, isOpen, onClose }: { worker: Worker | null, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !worker) return null;
  
    const ppes = worker.assigned_ppes || [];
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('assigned_ppes_title')} - {worker.name}</DialogTitle>
          </DialogHeader>
          {ppes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('item_name')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead>{t('date_assigned')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ppes.map((ppe, index) => (
                  <TableRow key={index}>
                    <TableCell>{ppe.itemName}</TableCell>
                    <TableCell className="text-right">{ppe.quantity}</TableCell>
                    <TableCell>{new Date(ppe.dateAssigned).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-4">{t('no_ppes_assigned')}</p>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('worker_management_title')}</CardTitle>
          <CardDescription>{t('manage_your_workers')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Input
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="ml-auto flex gap-2">
              <Button onClick={() => setIsImportDialogOpen(true)} variant="outline"><Upload className="mr-2 h-4 w-4" /> {t('import_from_csv')}</Button>
              <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> {t('export_to_csv')}</Button>
              <Button onClick={handleOpenAddDialog}><PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_worker')}</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('company')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>{worker.company?.name || t('uncategorized')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleViewPpes(worker)} title={t('view_ppes')}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleViewQr(worker)} title={t('view_qr')}><QrCode className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(worker)} title={t('edit_worker')}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteWorker(worker.id)} title={t('delete')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {renderWorkerDialog(false)}
      {renderWorkerDialog(true)}

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('qr_code_for', { workerName: editingWorker?.name })}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-4">
            <p>{t('scan_this_qr_code')}</p>
            {editingWorker?.id && (
              <div className="p-4 bg-white">
                <QRCode value={editingWorker.id} size={200} />
              </div>
            )}
            <p className="font-bold">{t('system_generated_qr')}</p>
            {editingWorker?.external_qr_code_data && (
              <>
                <div className="p-4 bg-white mt-4">
                  <QRCode value={editingWorker.external_qr_code_data} size={200} />
                </div>
                <p className="font-bold">{t('external_qr_code')}</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('import_workers')}</DialogTitle>
          </DialogHeader>
          <p>{t('import_instructions_workers')}</p>
          <Input type="file" accept=".csv" onChange={handleImport} />
        </DialogContent>
      </Dialog>

      <PpeDetailsModal
        worker={selectedWorkerForPpe}
        isOpen={isPpeModalOpen}
        onClose={() => setIsPpeModalOpen(false)}
      />
    </div>
  );
};

export default WorkerManagement;