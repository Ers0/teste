import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, QrCode, Download, ArrowLeft, RefreshCw } from 'lucide-react'; // Added RefreshCw icon
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '@/integrations/supabase/auth'; // Import useAuth
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: string | null;
  photo?: File | null; // Added for temporary file storage
  user_id: string; // Added user_id
}

const Workers = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { user } = useAuth(); // Get the current user
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newWorker, setNewWorker] = useState({ name: '', company: '', photo: null as File | null, qr_code_data: crypto.randomUUID() }); // Pre-fill with UUID
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const qrCodeRef = useRef<HTMLCanvasElement>(null); // Ref for QR code canvas

  // Moved currentQrCodeData declaration here
  const currentQrCodeData = editingWorker ? editingWorker.qr_code_data : newWorker.qr_code_data;

  useEffect(() => {
    if (user) { // Only fetch if user is logged in
      fetchWorkers();
    }
  }, [user]);

  // Effect to draw QR code on canvas when currentQrCodeData changes
  useEffect(() => {
    if (qrCodeRef.current && currentQrCodeData) {
      QRCode.toCanvas(qrCodeRef.current, currentQrCodeData, { scale: 4 }, function (error) {
        if (error) console.error(error);
      });
    }
  }, [currentQrCodeData]);

  const fetchWorkers = async () => {
    if (!user) return; // Ensure user is available
    const { data, error } = await supabase.from('workers').select('*').eq('user_id', user.id); // Filter by user_id
    if (error) {
      showError(t('error_fetching_workers') + error.message);
    } else {
      setWorkers(data);
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
    if (!newWorker.name) {
      showError(t('fill_worker_name'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    // Ensure QR code data is generated if not already present (e.g., if user cleared it)
    const qrDataToUse = newWorker.qr_code_data || crypto.randomUUID();

    const { data: insertedWorker, error: insertError } = await supabase
      .from('workers')
      .insert([{ name: newWorker.name, company: newWorker.company, qr_code_data: qrDataToUse, user_id: user.id }]) // Set user_id
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
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() }); // Reset with new UUID
    setIsDialogOpen(false);
    fetchWorkers();
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker || !editingWorker.name) {
      showError(t('fill_worker_name'));
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

    // Ensure QR code data is generated if it's empty during an update
    const qrDataToUse = editingWorker.qr_code_data || crypto.randomUUID();

    const { error } = await supabase
      .from('workers')
      .update({
        name: editingWorker.name,
        company: editingWorker.company,
        photo_url: photoUrl,
        qr_code_data: qrDataToUse, // Use the potentially new QR data
        user_id: user.id // Ensure user_id is maintained/updated
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
    // If worker has no QR code data, generate one when opening for edit
    if (!worker.qr_code_data) {
      setEditingWorker({ ...worker, qr_code_data: crypto.randomUUID() });
    } else {
      setEditingWorker(worker);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingWorker(null);
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() }); // Reset with new UUID
  };

  const handleDownloadQrCode = (workerName: string, qrData: string) => {
    if (qrCodeRef.current) {
      const canvas = qrCodeRef.current; // Direct reference to the canvas
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workerName}_QR_Code.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSuccess(t('qr_code_downloaded'));
      } else {
        showError(t('qr_code_canvas_not_found'));
      }
    }
  };

  const handleGenerateNewQrCode = () => {
    const newUuid = crypto.randomUUID();
    if (editingWorker) {
      setEditingWorker({ ...editingWorker, qr_code_data: newUuid });
    } else {
      setNewWorker({ ...newWorker, qr_code_data: newUuid });
    }
    showSuccess(t('new_qr_code_generated'));
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
              <CardDescription>{t('manage_construction_workers')}</CardDescription>
            </div>
            <div className="w-10"></div> {/* Placeholder for alignment */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setNewWorker({ name: '', company: '', photo: null, qr_code_data: crypto.randomUUID() }); setEditingWorker(null); setIsDialogOpen(true); }}>
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
                    <Label htmlFor="qr_code_data" className="text-right">
                      {t('qr_code_data')}
                    </Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Input
                        id="qr_code_data"
                        name="qr_code_data"
                        value={currentQrCodeData || ''}
                        readOnly // Make it read-only
                        className="flex-grow"
                        placeholder={t('qr_code_data_generated')}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={handleGenerateNewQrCode}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {currentQrCodeData && (
                    <div className="col-span-4 flex flex-col items-center gap-2">
                      <div className="p-2 border rounded-md bg-white">
                        <canvas ref={qrCodeRef} /> {/* Render QR code on canvas */}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQrCode(editingWorker?.name || newWorker.name || 'worker', currentQrCodeData)}
                        className="mt-2"
                      >
                        <Download className="mr-2 h-4 w-4" /> {t('download_qr_code')}
                      </Button>
                    </div>
                  )}
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
                    {editingWorker?.photo_url && (
                      <img src={editingWorker.photo_url} alt={editingWorker.name} className="col-span-4 w-24 h-24 object-cover rounded-full mt-2 mx-auto" />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>{t('cancel')}</Button>
                  <Button onClick={editingWorker ? handleUpdateWorker : handleAddWorker}>
                    {editingWorker ? t('save_changes') : t('add_new_worker')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((worker) => (
              <Card key={worker.id} className="flex flex-col items-center text-center p-4">
                {worker.photo_url && (
                  <img src={worker.photo_url} alt={worker.name} className="w-24 h-24 object-cover rounded-full mb-4" />
                )}
                <CardHeader className="p-0 mb-2">
                  <CardTitle className="text-xl">{worker.name}</CardTitle>
                  <CardDescription>{worker.company || 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow p-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('qr_data')}:</strong> {worker.qr_code_data || 'N/A'}</p>
                  {worker.qr_code_data && (
                    <div className="mt-2 flex justify-center">
                      {/* Render QR code for display in the list */}
                      <canvas
                        ref={(el) => {
                          if (el && worker.qr_code_data) {
                            QRCode.toCanvas(el, worker.qr_code_data, { scale: 2 }, function (error) {
                              if (error) console.error(error);
                            });
                          }
                        }}
                        width={64}
                        height={64}
                      />
                    </div>
                  )}
                </CardContent>
                <div className="p-4 flex justify-center gap-2 w-full">
                  <Button variant="outline" size="icon" onClick={() => openEditDialog(worker)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteWorker(worker.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {workers.length === 0 && (
              <p className="col-span-full text-center text-gray-500">{t('no_workers_found')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Workers;