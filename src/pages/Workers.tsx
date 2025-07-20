import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, QrCode, Upload, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface Worker {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
  qr_code_data: string | null;
  photo?: File | null; // Added for temporary file storage
}

const Workers = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [newWorker, setNewWorker] = useState({ name: '', company: '', photo: null as File | null, qr_code_data: '' });
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    const { data, error } = await supabase.from('workers').select('*');
    if (error) {
      showError('Error fetching workers: ' + error.message);
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
      showError('Error uploading photo: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddWorker = async () => {
    if (!newWorker.name) {
      showError('Please fill in worker name.');
      return;
    }

    const { data: insertedWorker, error: insertError } = await supabase
      .from('workers')
      .insert([{ name: newWorker.name, company: newWorker.company, qr_code_data: newWorker.qr_code_data }])
      .select()
      .single();

    if (insertError) {
      showError('Error adding worker: ' + insertError.message);
      return;
    }

    let photoUrl = null;
    if (newWorker.photo && insertedWorker) {
      photoUrl = await uploadPhoto(newWorker.photo, insertedWorker.id);
      if (photoUrl) {
        await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', insertedWorker.id);
      }
    }

    showSuccess('Worker added successfully!');
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: '' });
    setIsDialogOpen(false);
    fetchWorkers();
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker || !editingWorker.name) {
      showError('Please fill in worker name.');
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
        qr_code_data: editingWorker.qr_code_data,
      })
      .eq('id', editingWorker.id);

    if (error) {
      showError('Error updating worker: ' + error.message);
    } else {
      showSuccess('Worker updated successfully!');
      setEditingWorker(null);
      setIsDialogOpen(false);
      fetchWorkers();
    }
  };

  const handleDeleteWorker = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) {
        showError('Error deleting worker: ' + error.message);
      } else {
        showSuccess('Worker deleted successfully!');
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
    setNewWorker({ name: '', company: '', photo: null, qr_code_data: '' });
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
              <CardTitle className="text-3xl font-bold">Worker Management</CardTitle>
              <CardDescription>Manage your construction workers.</CardDescription>
            </div>
            <div className="w-10"></div> {/* Placeholder for alignment */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setNewWorker({ name: '', company: '', photo: null, qr_code_data: '' }); setEditingWorker(null); setIsDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Worker
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingWorker ? 'Edit Worker' : 'Add New Worker'}</DialogTitle>
                  <DialogDescription>
                    {editingWorker ? 'Make changes to the worker here.' : 'Add a new worker to your system.'}
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
                      value={editingWorker ? editingWorker.name : newWorker.name}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="company" className="text-right">
                      Company
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
                      QR Code Data
                    </Label>
                    <Input
                      id="qr_code_data"
                      name="qr_code_data"
                      value={editingWorker ? editingWorker.qr_code_data || '' : newWorker.qr_code_data}
                      onChange={handleInputChange}
                      className="col-span-3"
                      placeholder="Enter QR code data or scan"
                    />
                    <Button variant="outline" size="icon" className="col-span-1 ml-auto">
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="photo" className="text-right">
                      Photo
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
                      <img src={editingWorker.photo_url} alt="Worker" className="col-span-4 w-24 h-24 object-cover rounded-full mt-2 mx-auto" />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button onClick={editingWorker ? handleUpdateWorker : handleAddWorker}>
                    {editingWorker ? 'Save Changes' : 'Add Worker'}
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
                  <p className="text-sm text-gray-600 dark:text-gray-400"><strong>QR Data:</strong> {worker.qr_code_data || 'N/A'}</p>
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
              <p className="col-span-full text-center text-gray-500">No workers found. Add one above!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Workers;