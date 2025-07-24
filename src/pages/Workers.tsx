import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { PlusCircle, Edit, Trash2, ArrowLeft, QrCode, Image as ImageIcon, Camera, Download, Upload, Users, Star } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import QRCode from '@/components/QRCodeWrapper';
import { v4 as uuidv4 } from 'uuid';
import { Html5Qrcode } from 'html5-qrcode';
import { exportToCsv } from '@/utils/export';
import { parseCsv } from '@/utils/import';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { Worker } from '@/types';

const initialNewWorkerState = {
  name: '',
  company: '',
  photo: null as File | null,
  qr_code_data: '',
  external_qr_code_data: '',
};

const Workers = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [groupedWorkers, setGroupedWorkers] = useState<Record<string, Worker[]>>({});
  const [newWorker, setNewWorker] = useState<typeof initialNewWorkerState>(initialNewWorkerState);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [qrCodeDataToDisplay, setQrCodeDataToDisplay] = useState('');
  const [externalQrCodeDataToDisplay, setExternalQrCodeDataToDisplay] = useState('');
  const [qrCodeWorkerName, setQrCodeWorkerName] = useState('');
  const navigate = useNavigate();

  const [isScanningExternalQr, setIsScanningExternalQr] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);

  const { data: workers, refetch: fetchWorkers } = useQuery<Worker[]>({
    queryKey: ['workers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('workers')
        .select('*, external_qr_code_data, reliability_score')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (workers) {
      const groups = workers.reduce((acc, worker) => {
        const companyName = worker.company || t('uncategorized');
        if (!acc[companyName]) {
          acc[companyName] = [];
        }
        acc[companyName].push(worker);
        return acc;
      }, {} as Record<string, Worker[]>);
      setGroupedWorkers(groups);
    }
  }, [workers, t]);

  useEffect(() => {
    const stopWebScanner = async () => {
      if (html5QrCodeScannerRef.current) {
        try {
          await html5QrCodeScannerRef.current.stop();
          html5QrCodeScannerRef.current.clear();
        } catch (error) {
          console.error("Failed to stop or clear html5Qrcode: ", error);
        } finally {
          html5QrCodeScannerRef.current = null;
        }
      }
    };

    if (isScanningExternalQr) {
      const startWebScanner = async () => {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            let cameraId = cameras[0].id;
            const backCamera = cameras.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('environment')
            );
            if (backCamera) {
              cameraId = backCamera.id;
            } else if (cameras.length > 1) {
              cameraId = cameras[1].id;
            }

            const readerElementId = "external-qr-reader";
            const readerElement = document.getElementById(readerElementId);

            if (!readerElement) {
              console.error(`HTML Element with id=${readerElementId} not found during web scan start attempt.`);
              showError(t('camera_display_area_not_found'));
              setIsScanningExternalQr(false);
              setIsDialogOpen(true);
              return;
            }

            setTimeout(async () => {
              if (html5QrCodeScannerRef.current) {
                await html5QrCodeScannerRef.current.stop().catch(() => {});
                html5QrCodeScannerRef.current.clear();
                html5QrCodeScannerRef.current = null;
              }
              try {
                const html5Qrcode = new Html5Qrcode(readerElement.id);
                html5QrCodeScannerRef.current = html5Qrcode;

                await html5Qrcode.start(
                  cameraId,
                  { fps: 10, qrbox: { width: 300, height: 150 }, disableFlip: false },
                  (decodedText) => {
                    console.log("Web scan successful:", decodedText);
                    if (editingWorker) {
                      setEditingWorker({ ...editingWorker, external_qr_code_data: decodedText });
                    } else {
                      setNewWorker({ ...newWorker, external_qr_code_data: decodedText });
                    }
                    setIsScanningExternalQr(false);
                    setIsDialogOpen(true);
                  },
                  () => {
                    // QR Code Scan Error
                  }
                );
              } catch (err: any) {
                console.error(`Failed to start camera ${cameraId}:`, err);
                showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
                setIsScanningExternalQr(false);
                setIsDialogOpen(true);
              }
            }, 200);
          } else {
            showError(t('no_camera_found_access_denied'));
            setIsScanningExternalQr(false);
            setIsDialogOpen(true);
          }
        } catch (err: any) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          showError(t('error_starting_web_camera_scan') + errorMessage + t('check_camera_permissions'));
          setIsScanningExternalQr(false);
          setIsDialogOpen(true);
        }
      };
      startWebScanner();
    } else {
      stopWebScanner();
    }

    return () => {
      stopWebScanner();
    };
  }, [isScanningExternalQr, editingWorker, newWorker, t]);

  const startExternalQrScan = () => {
    setIsDialogOpen(false);
    setIsScanningExternalQr(true);
  };

  const stopExternalQrScan = () => {
    setIsScanningExternalQr(false);
    setIsDialogOpen(true);
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
        setEditingWorker({ ...editingWorker, photo: e.target.files[0] as any });
      } else {
        setNewWorker({ ...newWorker, photo: e.target.files[0] });
      }
    }
  };

  const uploadPhoto = async (file: File, workerId: string) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = fileName;

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

    const workerId = uuidv4();
    let photoUrl = null;
    if (newWorker.photo) {
      photoUrl = await uploadPhoto(newWorker.photo, workerId);
    }

    const { error: insertError } = await supabase.from('workers').insert({
      id: workerId,
      name: newWorker.name,
      company: newWorker.company,
      qr_code_data: uuidv4(),
      external_qr_code_data: newWorker.external_qr_code_data.trim() || null,
      user_id: user.id,
      reliability_score: 100,
      photo_url: photoUrl,
    });
    if (insertError) {
      showError(t('error_adding_worker') + insertError.message);
      return;
    }
    showSuccess(t('worker_added_successfully'));
    fetchWorkers();
    setNewWorker(initialNewWorkerState);
    setIsDialogOpen(false);
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

    const updatedData: Partial<Worker> = {
      name: editingWorker.name,
      company: editingWorker.company,
      external_qr_code_data: editingWorker.external_qr_code_data?.trim() || null,
      photo_url: editingWorker.photo_url,
    };

    if ((editingWorker as any).photo instanceof File) {
      updatedData.photo_url = await uploadPhoto((editingWorker as any).photo, editingWorker.id);
    }
    const { error } = await supabase.from('workers').update(updatedData).eq('id', editingWorker.id);
    if (error) {
      showError(t('error_updating_worker') + error.message);
    } else {
      showSuccess(t('worker_updated_successfully'));
      fetchWorkers();
    }

    setEditingWorker(null);
    setIsDialogOpen(false);
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

  const openQrCodeDialog = (systemQrData: string | null, externalQrData: string | null, workerName: string) => {
    setQrCodeDataToDisplay(systemQrData || '');
    setExternalQrCodeDataToDisplay(externalQrData || '');
    setQrCodeWorkerName(workerName);
    setIsQrCodeDialogOpen(true);
  };

  const closeQrCodeDialog = () => {
    setIsQrCodeDialogOpen(false);
    setQrCodeDataToDisplay('');
    setExternalQrCodeDataToDisplay('');
    setQrCodeWorkerName('');
  };

  const handleExport = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workers')
      .select('name, company, external_qr_code_data, reliability_score')
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_exporting_workers') + error.message);
      return;
    }
    if (!data || data.length === 0) {
      showError(t('no_data_to_export'));
      return;
    }

    exportToCsv(data, 'workers_report.csv');
    showSuccess(t('workers_exported_successfully'));
  };

  const handleExportCompanyReport = (companyName: string, companyWorkers: Worker[]) => {
    if (!companyWorkers || companyWorkers.length === 0) {
      showError(t('no_workers_to_export_for_this_company'));
      return;
    }

    const formattedData = companyWorkers.map(worker => ({
      name: worker.name,
      company: worker.company,
      external_qr_code_data: worker.external_qr_code_data || '',
      reliability_score: worker.reliability_score,
    }));

    const filename = `${companyName.replace(/\s+/g, '_')}_workers_report.csv`;
    exportToCsv(formattedData, filename);
    showSuccess(t('company_report_exported_successfully', { companyName }));
  };

  const handleImport = async () => {
    if (!fileToImport || !user) {
      showError(t('no_file_selected'));
      return;
    }

    const toastId = showLoading(t('importing'));
    try {
      const parsedData = await parseCsv<{ name: string; company?: string; external_qr_code_data?: string }>(fileToImport);
      const workersToImport = parsedData.map(row => ({
        user_id: user.id,
        name: row.name,
        company: row.company || null,
        external_qr_code_data: row.external_qr_code_data || null,
        qr_code_data: uuidv4(),
      }));

      const { error } = await supabase.from('workers').upsert(workersToImport, { onConflict: 'user_id,name' });

      if (error) {
        throw error;
      }

      dismissToast(toastId);
      showSuccess(t('workers_imported_successfully', { count: workersToImport.length }));
      setIsImportDialogOpen(false);
      setFileToImport(null);
      fetchWorkers();
    } catch (error: any) {
      dismissToast(toastId);
      showError(t('error_importing_workers') + error.message);
    }
  };

  const getScoreVariant = (score: number | null): 'default' | 'secondary' | 'destructive' => {
    const currentScore = score ?? 100;
    if (currentScore >= 80) return 'default';
    if (currentScore >= 50) return 'secondary';
    return 'destructive';
  };

  const downloadQRCode = (svgId: string, workerName: string, type: 'system' | 'external') => {
    const svg = document.getElementById(svgId);
    if (!svg) {
      showError('QR Code element not found.');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        showError('Could not get canvas context.');
        return;
    }
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${workerName.replace(/\s+/g, '_')}_${type}_qrcode.png`;
      downloadLink.href = pngFile;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <React.Fragment>
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${isScanningExternalQr ? '' : 'hidden'}`}>
          <div id="external-qr-reader" className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
          <Button onClick={stopExternalQrScan} className="mt-4" variant="secondary">
            {t('cancel_scan')}
          </Button>
          <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
        </div>

        <Card className={`w-full max-w-4xl mx-auto`}>
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
            <div className="flex flex-wrap justify-end mb-4 gap-2">
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
                      <Label htmlFor="external_qr_code_data" className="text-right">
                        {t('external_qr_code')}
                      </Label>
                      <Input
                        id="external_qr_code_data"
                        name="external_qr_code_data"
                        value={editingWorker ? editingWorker.external_qr_code_data || '' : newWorker.external_qr_code_data}
                        onChange={handleInputChange}
                        className="col-span-3"
                        placeholder={t('optional_pre_existing_qr')}
                      />
                      <Button variant="outline" size="icon" className="col-span-1 ml-auto" onClick={startExternalQrScan}>
                        <Camera className="h-4 w-4" />
                      </Button>
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
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> {t('import_from_csv')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('import_workers')}</DialogTitle>
                    <DialogDescription>{t('import_instructions_workers')}</DialogDescription>
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

            <div className="overflow-x-auto">
              <Accordion type="multiple" className="w-full">
                {Object.entries(groupedWorkers).map(([company, companyWorkers]) => (
                  <AccordionItem value={company} key={company}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <span className="font-semibold">{company}</span>
                          <Badge variant="secondary">{companyWorkers.length}</Badge>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportCompanyReport(company, companyWorkers);
                              }}
                              className="mr-2 hover:bg-accent"
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">{t('export_company_report')}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('export_company_report')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">{t('photo')}</TableHead>
                            <TableHead>{t('name')}</TableHead>
                            <TableHead>{t('reliability_score')}</TableHead>
                            <TableHead className="text-center">{t('qr_code')}</TableHead>
                            <TableHead className="text-center">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyWorkers.map((worker) => (
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
                              <TableCell>
                                <Badge variant={getScoreVariant(worker.reliability_score)}>
                                  <Star className="mr-1 h-3 w-3" />
                                  {worker.reliability_score ?? 100}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {(worker.qr_code_data || worker.external_qr_code_data) ? (
                                  <Button variant="outline" size="sm" onClick={() => openQrCodeDialog(worker.qr_code_data, worker.external_qr_code_data, worker.name)}>
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
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isQrCodeDialogOpen} onOpenChange={setIsQrCodeDialogOpen}>
          <DialogContent className="sm:max-w-[350px] text-center">
            <DialogHeader>
              <DialogTitle>{t('qr_code_for', { workerName: qrCodeWorkerName })}</DialogTitle>
              <DialogDescription>
                {t('scan_this_qr_code')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-4 space-y-4">
              {qrCodeDataToDisplay && (
                <div className="border p-2 rounded-md flex flex-col items-center gap-2">
                  <p className="text-sm font-semibold mb-2">{t('system_generated_qr')}</p>
                  <QRCode id="system-qr-code" value={qrCodeDataToDisplay} size={200} level="H" />
                  <Button variant="outline" size="sm" onClick={() => downloadQRCode('system-qr-code', qrCodeWorkerName, 'system')}>
                    <Download className="mr-2 h-4 w-4" /> {t('download')}
                  </Button>
                </div>
              )}
              {externalQrCodeDataToDisplay && (
                <div className="border p-2 rounded-md flex flex-col items-center gap-2">
                  <p className="text-sm font-semibold mb-2">{t('external_qr_code')}</p>
                  <QRCode id="external-qr-code" value={externalQrCodeDataToDisplay} size={200} level="H" />
                  <Button variant="outline" size="sm" onClick={() => downloadQRCode('external-qr-code', qrCodeWorkerName, 'external')}>
                    <Download className="mr-2 h-4 w-4" /> {t('download')}
                  </Button>
                </div>
              )}
              {!qrCodeDataToDisplay && !externalQrCodeDataToDisplay && (
                <p className="text-gray-500">{t('no_qr_codes_available')}</p>
              )}
            </div>
            <DialogFooter className="flex justify-center">
              <Button onClick={closeQrCodeDialog}>{t('close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </React.Fragment>
  );
};

export default Workers;