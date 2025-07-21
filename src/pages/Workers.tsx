import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, ArrowLeft, QrCode, Image as ImageIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique QR code data

interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: string | null;
  user_id: string;
  photo?: File | null; // For file upload
}

const initialNewWorkerState = {
  name: '',
  company: '',
  photo: null as File | null,
  qr_code_data: '',
};

const Workers = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newWorker, setNewWorker] = useState<typeof initialNewWorkerState>(initialNewWorkerState);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [qrCodeDataToDisplay, setQrCodeDataToDisplay] = useState('');
  const [qrCodeWorkerName, setQrCodeWorkerName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchWorkers();
    }
  }, [user]);

  const fetchWorkers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      showError(t('error_fetching_workers') + error.message);
    } else {
      setWorkers(data || []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingWorker) {
      setEditingWorker({ ...editingWorker, [name]: value });
    } else {
      setNewWorker({ ...newWorker, [name]: value });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (editingWorker) {
        setEditingWorker({ ...editingWorker, photo: e.target.files[0] });
      } else {
        setNewWorker({ ...newWorker, photo: e.target.files[0] });
      }
    }
  };

  const uploadPhoto = async (file: File | null, workerId: string) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = `worker_photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('worker-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      showError(t('error_uploading_photo') + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddWorker = async () => {
    if (!newWorker.name.trim()) {
      showError(t('worker_name_required'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const generatedQrCodeData = uuidv4(); // Generate a unique QR code data

    const { data: insertedWorker, error: insertError } = await supabase
      .from('workers')
      .insert([{ 
        name: newWorker.name, 
        company: newWorker.company, 
        qr_code_data: generatedQrCodeData,
        user_id: user.id 
      }])
      .select()
      .single();

    if (insertError) {
      showError(t('error_adding_worker') + insertError.message);
      return;
    }

    let photoUrl = null;
    if (newWorker.photo && insertedWorker) {
      photoUrl = await uploadPhoto(newWorker.photo, insertedWorker.id);
      if (photoUrl) {
        await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', insertedWorker.id);
      }
    }

    showSuccess(t('worker_added_successfully'));
    setNewWorker(initialNewWorkerState);
    setIsDialogOpen(false);
    fetchWorkers();
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker || !editingWorker.name.trim()) {
      showError(t('worker_name_required'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    let photoUrl = editingWorker.photo_url;
    if (editingWorker.photo instanceof File) {
      photoUrl = await uploadPhoto(editingWorker.photo, editingWorker.id);
    }

    const { error } = await supabase
      .from('workers')
      .update({
        name: editingWorker.name,
        company: editingWorker.company,
        photo_url: photoUrl,
        qr_code_data: editingWorker.qr_code_data, // Keep existing QR code data
        user_id: user.id
      })
      .eq('id', editingWorker.id);

    if (error) {
      showError(t('error_updating_worker') + error.message);
    } else {
      showSuccess(t('worker_updated_successfully'));
      setEditingWorker(null);
      setIsDialogOpen(false);
      fetchWorkers();
    }
  };

  const handleDeleteWorker = async (id: string) => {
    if (window.confirm(t('confirm_delete_worker'))) {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) {
        showError(t('error_deleting_worker') + error.message);
      } else {
        showSuccess(t('worker_deleted_successfully'));
        fetchWorkers();
      }
    }
  };

  const openEditDialog = (worker: Worker) => {
    setEditingWorker(worker);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingWorker(null);
    setNewWorker(initialNewWorkerState);
  };

  const openQrCodeDialog = (qrData: string, workerName: string) => {
    setQrCodeDataToDisplay(qrData);
    setQrCodeWorkerName(workerName);
    setIsQrCodeDialogOpen(true);
  };

  const closeQrCodeDialog = () => {
    setIsQrCodeDialogOpen(false);
    setQrCodeDataToDisplay('');
    setQrCodeWorkerName('');
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
              <CardTitle className="text-3xl font-bold">{t('worker_management_title')}</CardTitle>
              <CardDescription>{t('manage_your_workers')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setNewWorker(initialNewWorkerState); setEditingWorker(null); setIsDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('add_new_worker')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingWorker ? t('edit_worker') : t('add_new_worker')}</DialogTitle>
                  <DialogDescription>
                    {editingWorker ? t('make_changes_to_worker') : t('add_new_worker_to_system')}
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
                      value={editingWorker ? editingWorker.name : newWorker.name}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="company" className="text-right">
                      {t('company')}
                    </Label>
                    <Input
                      id="company"
                      name="company"
                      value={editingWorker ? editingWorker.company || '' : newWorker.company}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="photo" className="text-right">
                      {t('photo')}
                    </Label>
                    <Input
                      id="photo"
                      name="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="col-span-3"
                    />
                    {(editingWorker?.photo_url || (newWorker.photo && URL.createObjectURL(newWorker.photo))) && (
                      <img 
                        src={editingWorker?.photo_url || (newWorker.photo ? URL.createObjectURL(newWorker.photo) : '')} 
                        alt={editingWorker?.name || newWorker.name || t('worker_photo')} 
                        className="col-span-4 w-24 h-24 object-cover rounded-full mt-2 mx-auto" 
                      />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                  <Button onClick={editingWorker ? handleUpdateWorker : handleAddWorker}>
                    {editingWorker ? t('save_changes') : t('add_worker')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t('photo')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('company')}</TableHead>
                  <TableHead className="text-center">{t('qr_code')}</TableHead>
                  <TableHead className="text-center">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      {t('no_workers_found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  workers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        {worker.photo_url ? (
                          <img src={worker.photo_url} alt={worker.name} className="w-16 h-16 object-cover rounded-full" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 text-xs">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell>{worker.company || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        {worker.qr_code_data ? (
                          <Button variant="outline" size="sm" onClick={() => openQrCodeDialog(worker.qr_code_data!, worker.name)}>
                            <QrCode className="h-4 w-4 mr-2" /> {t('view_qr')}
                          </Button>
                        ) : (
                          <span className="text-gray-500">{t('not_available')}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(worker)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteWorker(worker.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Link to={`/worker-report/${worker.id}`}>
                            <Button variant="outline" size="icon">
                              <ImageIcon className="h-4 w-4" /> {/* Reusing ImageIcon for report, consider a more fitting icon if available */}
                            </Button>
                          </Link>
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

      {/* QR Code Display Dialog */}
      <Dialog open={isQrCodeDialogOpen} onOpenChange={setIsQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-[350px] text-center">
          <DialogHeader>
            <DialogTitle>{t('qr_code_for', { workerName: qrCodeWorkerName })}</DialogTitle>
            <DialogDescription>
              {t('scan_this_qr_code')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCodeDataToDisplay && (
              <QRCode value={qrCodeDataToDisplay} size={256} level="H" includeMargin={true} />
            )}
          </div>
          <DialogFooter className="flex justify-center">
            <Button onClick={closeQrCodeDialog}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Workers;