import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { QrCode, Barcode, ArrowLeft, Package, Users, History as HistoryIcon, Plus, Minus, Camera, Flashlight, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode } from 'html5-qrcode';
import { setBodyBackground, addCssClass, removeCssClass } from '@/utils/camera-utils';
import beepSound from '/beep.mp3';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToPdf } from '@/utils/pdf';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface Worker {
  id: string;
  name: string;
  company: string | null;
  qr_code_data: string | null;
  external_qr_code_data: string | null;
  user_id: string;
  reliability_score: number;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  one_time_use: boolean;
  is_tool: boolean;
  user_id: string;
  tags: string[] | null;
}

interface Transaction {
  id: string;
  item_id: string;
  worker_id: string | null;
  company: string | null;
  type: 'takeout' | 'return';
  quantity: number;
  timestamp: string;
  items: { name: string };
  workers: { name: string } | null;
  user_id: string;
  authorized_by: string | null;
  given_by: string | null;
  is_broken: boolean;
}

interface TransactionItem {
  item: Item;
  quantity: number;
  type: 'takeout' | 'return';
  is_broken?: boolean;
}

const WorkerTransaction = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [workerQrCodeInput, setWorkerQrCodeInput] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [workerSearchResults, setWorkerSearchResults] = useState<Worker[]>([]);
  const [scannedWorker, setScannedWorker] = useState<Worker | null>(null);
  const [itemBarcodeInput, setItemBarcodeInput] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [quantityToChange, setQuantityToChange] = useState(1);
  const [transactionType, setTransactionType] = useState<'takeout' | 'return'>('takeout');
  const [isBroken, setIsBroken] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');
  const [activeTab, setActiveTab] = useState('transaction-form');
  const navigate: NavigateFunction = useNavigate();
  const queryClient = useQueryClient();

  const [selectionMode, setSelectionMode] = useState<'worker' | 'company'>('worker');
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const [scanningWorker, setScanningWorker] = useState(false);
  const [scanningItem, setScanningItem] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Error playing sound:", e));
    }
  };

  useEffect(() => {
    if (user) {
      fetchCompanies();
    }
  }, [user]);

  const fetchCompanies = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workers')
      .select('company')
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_fetching_companies') + error.message);
    } else if (data) {
      const uniqueCompanies = [...new Set(data.map(w => w.company).filter(Boolean))] as string[];
      setCompanies(uniqueCompanies.sort());
    }
  };

  useEffect(() => {
    const currentIsWeb = !Capacitor.isNativePlatform();
    setIsWeb(currentIsWeb);

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

    const stopNativeScanner = async () => {
      try {
        await BarcodeScanner.stopScan();
        await BarcodeScanner.showBackground();
        if (isTorchOn) {
          await BarcodeScanner.disableTorch();
          setIsTorchOn(false);
        }
      } catch (e) {
        console.error("Error stopping native barcode scanner:", e);
      } finally {
        setBodyBackground('');
        removeCssClass('barcode-scanner-active');
      }
    };

    const startScanner = async (readerElementId: string, onScanSuccess: (decodedText: string) => void) => {
      if (currentIsWeb) {
        await stopNativeScanner();
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            let cameraId = cameras[0].id;
            const backCamera = cameras.find(camera => camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment'));
            if (backCamera) cameraId = backCamera.id;
            else if (cameras.length > 1) cameraId = cameras[1].id;

            const readerElement = document.getElementById(readerElementId);
            if (readerElement) {
              setTimeout(async () => {
                if (html5QrCodeScannerRef.current) {
                  await html5QrCodeScannerRef.current.stop().catch(() => {});
                  html5QrCodeScannerRef.current.clear();
                  html5QrCodeScannerRef.current = null;
                }
                try {
                  const html5Qrcode = new Html5Qrcode(readerElementId, { verbose: false });
                  html5QrCodeScannerRef.current = html5Qrcode;
                  await html5Qrcode.start(
                    cameraId,
                    { fps: 10, qrbox: { width: 300, height: 150 }, disableFlip: false },
                    onScanSuccess,
                    (errorMessage) => {}
                  );
                } catch (err: any) {
                  showError(t('could_not_start_video_source') + t('check_camera_permissions_or_close_apps'));
                  setScanningWorker(false);
                  setScanningItem(false);
                }
              }, 200);
            } else {
              showError(t('camera_display_area_not_found'));
              setScanningWorker(false);
              setScanningItem(false);
            }
          } else {
            showError(t('no_camera_found_access_denied'));
            setScanningWorker(false);
            setScanningItem(false);
          }
        } catch (err: any) {
          showError(t('error_starting_web_camera_scan') + (err.message || err) + t('check_camera_permissions'));
          setScanningWorker(false);
          setScanningItem(false);
        }
      } else { // Native
        await stopWebScanner();
        const hasPermission = await checkPermission();
        if (!hasPermission) {
          setScanningWorker(false);
          setScanningItem(false);
          return;
        }
        setBodyBackground('transparent');
        addCssClass('barcode-scanner-active');
        BarcodeScanner.hideBackground();
        const result = await BarcodeScanner.startScan();
        if (result.hasContent && result.content) {
          onScanSuccess(result.content);
        } else {
          showError(t('no_barcode_scanned_cancelled'));
          setScanningWorker(false);
          setScanningItem(false);
        }
      }
    };

    if (scanningWorker) {
      startScanner("worker-qr-reader", (decodedText) => {
        setWorkerQrCodeInput(decodedText);
        handleScanWorker(decodedText);
        playBeep();
        setScanningWorker(false);
      });
    } else if (scanningItem) {
      startScanner("item-barcode-reader", (decodedText) => {
        setItemBarcodeInput(decodedText);
        handleScanItem(decodedText);
        playBeep();
        setScanningItem(false);
      });
    } else {
      stopWebScanner();
      stopNativeScanner();
    }

    return () => {
      stopWebScanner();
      stopNativeScanner();
    };
  }, [scanningWorker, scanningItem, isWeb]);

  const checkPermission = async () => {
    const status = await BarcodeScanner.checkPermission({ force: true });
    if (status.granted) {
      return true;
    }
    if (status.denied) {
      showError(t('camera_permission_denied'));
    }
    return false;
  };

  const startWorkerScan = () => {
    setWorkerQrCodeInput('');
    setScannedWorker(null);
    setScanningWorker(true);
    setWorkerSearchTerm('');
    setWorkerSearchResults([]);
  };

  const stopWorkerScan = () => {
    setScanningWorker(false);
  };

  const startItemScan = () => {
    setItemBarcodeInput('');
    setScannedItem(null);
    setScanningItem(true);
    setItemSearchTerm('');
    setItemSearchResults([]);
  };

  const stopItemScan = () => {
    setScanningItem(false);
  };

  const toggleTorch = async () => {
    if (!Capacitor.isNativePlatform()) {
      showError(t('flashlight_native_only'));
      return;
    }
    try {
      if (isTorchOn) {
        await BarcodeScanner.disableTorch();
        setIsTorchOn(false);
        showSuccess(t('flashlight_off'));
      } else {
        await BarcodeScanner.enableTorch();
        setIsTorchOn(true);
        showSuccess(t('flashlight_on'));
      }
    } catch (e: any) {
      showError(t('failed_to_toggle_flashlight') + e.message);
    }
  };

  const { data: transactionsHistory, isLoading: isHistoryLoading, error: historyError } = useQuery<Transaction[], Error>({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name), company')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    enabled: !!user,
    staleTime: 1000 * 10,
  });

  const { data: outstandingTakeouts, isLoading: isOutstandingLoading, error: outstandingError } = useQuery<Transaction[], Error>({
    queryKey: ['outstandingTakeouts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(name), workers(name), company')
        .eq('user_id', user.id)
        .eq('type', 'takeout')
        .lt('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    enabled: !!user && activeTab === 'outstanding-takeouts',
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (historyError) {
      showError(t('error_fetching_transaction_history') + historyError.message);
    }
  }, [historyError, t]);

  useEffect(() => {
    if (outstandingError) {
      showError(t('error_fetching_outstanding_takeouts') + outstandingError.message);
    }
  }, [outstandingError, t]);

  const handleScanWorker = async (qrCodeData: string) => {
    if (!qrCodeData) {
      showError(t('enter_worker_qr_code_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .or(`qr_code_data.eq.${qrCodeData},external_qr_code_data.eq.${qrCodeData}`)
      .eq('user_id', user.id)
      .single();

    if (error) {
      showError(t('worker_not_found_error') + error.message);
      setScannedWorker(null);
    } else {
      setScannedWorker(data);
      showSuccess(t('worker_found', { workerName: data.name }));
      setWorkerQrCodeInput(qrCodeData);
      setWorkerSearchTerm('');
      setWorkerSearchResults([]);
    }
  };

  const handleSearchWorkerByName = async () => {
    if (!workerSearchTerm.trim()) {
      showError(t('enter_worker_name_to_search'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .ilike('name', `%${workerSearchTerm.trim()}%`)
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_searching_workers') + error.message);
      setWorkerSearchResults([]);
    } else if (data && data.length > 0) {
      if (data.length === 1) {
        setScannedWorker(data[0]);
        showSuccess(t('worker_found', { workerName: data[0].name }));
        setWorkerQrCodeInput(data[0].qr_code_data || data[0].external_qr_code_data || '');
        setWorkerSearchTerm('');
        setWorkerSearchResults([]);
      } else {
        setWorkerSearchResults(data);
        showSuccess(t('multiple_workers_found_select'));
      }
    } else {
      showError(t('no_workers_found_for_name'));
      setWorkerSearchResults([]);
    }
  };

  const handleSelectWorker = (worker: Worker) => {
    setScannedWorker(worker);
    setWorkerQrCodeInput(worker.qr_code_data || worker.external_qr_code_data || '');
    setWorkerSearchTerm(worker.name);
    setWorkerSearchResults([]);
    showSuccess(t('worker_selected', { workerName: worker.name }));
  };

  const handleClearWorker = () => {
    if (transactionItems.length > 0) {
      if (window.confirm(t('confirm_clear_worker_with_items'))) {
        setTransactionItems([]);
      } else {
        return;
      }
    }
    setScannedWorker(null);
    setWorkerQrCodeInput('');
    setWorkerSearchTerm('');
    setWorkerSearchResults([]);
    setSelectedCompany(null);
    showSuccess(t('selection_cleared'));
  };

  const handleScanItem = async (scannedBarcode?: string) => {
    const barcodeToSearch = scannedBarcode || itemBarcodeInput;
    if (!barcodeToSearch) {
      showError(t('enter_item_barcode_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('*, one_time_use, is_tool')
      .eq('barcode', barcodeToSearch)
      .eq('user_id', user.id)
      .single();

    if (error) {
      showError(t('item_not_found_error') + error.message);
      setScannedItem(null);
      setItemSearchTerm('');
      setItemSearchResults([]);
    } else {
      setScannedItem(data);
      showSuccess(t('item_found', { itemName: data.name }));
      setItemSearchTerm(data.name);
      setItemSearchResults([]);
      if (data.one_time_use) {
        setTransactionType('takeout');
        showError(t('this_is_one_time_use_item_takeout_only'));
      }
    }
  };

  const handleSearchItemByName = async () => {
    if (!itemSearchTerm.trim()) {
      showError(t('enter_item_name_to_search'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const searchTerms = itemSearchTerm.trim().split(/[\s,]+/).filter(Boolean);
    if (searchTerms.length === 0) {
      return;
    }

    // 1. Find tags matching the search terms
    const tagFilters = searchTerms.map(term => `name.ilike.%${term}%`).join(',');
    const { data: matchingTags, error: tagsError } = await supabase
      .from('tags')
      .select('id')
      .or(tagFilters)
      .eq('user_id', user.id);

    if (tagsError) {
      showError(t('error_searching_tags') + tagsError.message);
      return;
    }

    const matchingTagIds = matchingTags.map(tag => tag.id);

    // 2. Build filters for items
    const nameFilters = searchTerms.map(term => `name.ilike.%${term}%`);
    const allFilters = [...nameFilters];

    if (matchingTagIds.length > 0) {
      allFilters.push(`tags.cs.{${matchingTagIds.join(',')}}`);
    }

    // 3. Search for items
    const { data, error } = await supabase
      .from('items')
      .select('*, one_time_use, is_tool, tags')
      .or(allFilters.join(','))
      .eq('user_id', user.id);

    if (error) {
      showError(t('error_searching_items') + error.message);
      setItemSearchResults([]);
    } else if (data && data.length > 0) {
      if (data.length === 1) {
        setScannedItem(data[0]);
        showSuccess(t('item_found', { itemName: data[0].name }));
        setItemBarcodeInput(data[0].barcode || '');
        setItemSearchResults([]);
        if (data[0].one_time_use) {
          setTransactionType('takeout');
          showError(t('this_is_one_time_use_item_takeout_only'));
        }
      } else {
        setItemSearchResults(data);
        showSuccess(t('multiple_items_found_select'));
      }
    } else {
      showError(t('no_items_found_for_name'));
      setItemSearchResults([]);
    }
  };

  const handleSelectItem = (item: Item) => {
    setScannedItem(item);
    setItemBarcodeInput(item.barcode || '');
    setItemSearchTerm(item.name);
    setItemSearchResults([]);
    showSuccess(t('item_selected', { itemName: item.name }));
    if (item.one_time_use) {
      setTransactionType('takeout');
      showError(t('this_is_one_time_use_item_takeout_only'));
    }
  };

  const handleClearItem = () => {
    setScannedItem(null);
    setItemBarcodeInput('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    showSuccess(t('item_selection_cleared'));
  };

  const handleAddItemToList = async () => {
    if (!scannedItem) {
      showError(t('scan_item_first'));
      return;
    }
    if (quantityToChange <= 0) {
      showError(t('quantity_greater_than_zero'));
      return;
    }
    if (transactionType === 'takeout' && scannedItem.quantity < quantityToChange) {
      showError(t('not_enough_items_in_stock', { available: scannedItem.quantity }));
      return;
    }

    if (transactionType === 'return') {
      if (selectionMode === 'worker' && !scannedWorker) {
        showError(t('select_worker_before_return'));
        return;
      }
      if (selectionMode === 'company' && !selectedCompany) {
        showError(t('select_company_before_return'));
        return;
      }

      const toastId = showLoading(t('checking_worker_balance'));
      try {
        let query = supabase
          .from('transactions')
          .select('type, quantity')
          .eq('item_id', scannedItem.id)
          .eq('user_id', user!.id);

        if (selectionMode === 'worker') {
          query = query.eq('worker_id', scannedWorker!.id);
        } else {
          query = query.eq('company', selectedCompany!);
        }

        const { data: transactions, error } = await query;
        if (error) throw error;

        const balance = transactions.reduce((acc, tx) => {
          if (tx.type === 'takeout') return acc + tx.quantity;
          if (tx.type === 'return') return acc - tx.quantity;
          return acc;
        }, 0);

        if (quantityToChange > balance) {
          dismissToast(toastId);
          showError(t('cannot_return_more_than_taken', { balance }));
          return;
        }
        dismissToast(toastId);
      } catch (error: any) {
        dismissToast(toastId);
        showError(t('error_checking_balance') + error.message);
        return;
      }
    }

    setTransactionItems(prev => [...prev, {
      item: scannedItem,
      quantity: quantityToChange,
      type: transactionType,
      is_broken: transactionType === 'return' ? isBroken : false,
    }]);

    showSuccess(t('item_added_to_list', { itemName: scannedItem.name }));

    setScannedItem(null);
    setItemBarcodeInput('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setQuantityToChange(1);
    setIsBroken(false);
  };

  const handleRemoveItemFromList = (indexToRemove: number) => {
    setTransactionItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFinalizeTransactions = async () => {
    if (transactionItems.length === 0) {
      showError(t('no_items_in_transaction_list'));
      return;
    }
    if (selectionMode === 'worker' && !scannedWorker) {
      showError(t('scan_worker_first'));
      return;
    }
    if (selectionMode === 'company' && !selectedCompany) {
      showError(t('select_company_first'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }

    const toastId = showLoading(t('processing_transactions'));
    
    const takeoutItems = transactionItems.filter(item => item.type === 'takeout');
    const returnItems = transactionItems.filter(item => item.type === 'return');
    let requisitionCreated = false;

    try {
      let requisitionId: string | null = null;

      if (takeoutItems.length > 0) {
        const getNextRequisitionNumber = (): string => {
          const key = 'lastRequisitionNumber';
          let lastNumber = parseInt(localStorage.getItem(key) || '0', 10);
          const newNumber = lastNumber + 1;
          localStorage.setItem(key, newNumber.toString());
          return newNumber.toString().padStart(4, '0');
        };
        const requisitionNumber = getNextRequisitionNumber();

        const { data: requisitionData, error: requisitionError } = await supabase
          .from('requisitions')
          .insert({
            requisition_number: requisitionNumber,
            user_id: user.id,
            authorized_by: authorizedBy.trim() || null,
            given_by: givenBy.trim() || null,
            requester_name: selectionMode === 'worker' ? scannedWorker!.name : selectedCompany,
            requester_company: selectionMode === 'worker' ? scannedWorker!.company : selectedCompany,
            application_location: applicationLocation.trim() || null,
          })
          .select('id')
          .single();

        if (requisitionError) throw requisitionError;
        requisitionId = requisitionData.id;

        for (const txItem of takeoutItems) {
          const { data: currentItem, error: fetchError } = await supabase
            .from('items')
            .select('quantity')
            .eq('id', txItem.item.id)
            .single();

          if (fetchError || !currentItem) {
            throw new Error(t('error_fetching_item_details_for', { itemName: txItem.item.name }));
          }

          if (currentItem.quantity < txItem.quantity) {
            throw new Error(t('not_enough_stock_for_item', { itemName: txItem.item.name }));
          }
          const newQuantity = currentItem.quantity - txItem.quantity;

          const { error: updateError } = await supabase
            .from('items')
            .update({ quantity: newQuantity })
            .eq('id', txItem.item.id);

          if (updateError) {
            throw new Error(t('error_updating_quantity_for', { itemName: txItem.item.name }));
          }

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert([{
              requisition_id: requisitionId,
              worker_id: selectionMode === 'worker' ? scannedWorker!.id : null,
              company: selectionMode === 'company' ? selectedCompany : null,
              item_id: txItem.item.id,
              type: txItem.type,
              quantity: txItem.quantity,
              user_id: user.id,
              authorized_by: authorizedBy.trim() || null,
              given_by: givenBy.trim() || null,
              is_broken: false,
            }]);

          if (transactionError) {
            await supabase.from('items').update({ quantity: currentItem.quantity }).eq('id', txItem.item.id);
            throw new Error(t('error_recording_transaction_for', { itemName: txItem.item.name }));
          }
        }
        requisitionCreated = true;
      }

      for (const txItem of returnItems) {
        if (!txItem.is_broken) {
          const { data: currentItem, error: fetchError } = await supabase
            .from('items')
            .select('quantity')
            .eq('id', txItem.item.id)
            .single();

          if (fetchError || !currentItem) {
            throw new Error(t('error_fetching_item_details_for', { itemName: txItem.item.name }));
          }

          const newQuantity = currentItem.quantity + txItem.quantity;

          const { error: updateError } = await supabase
            .from('items')
            .update({ quantity: newQuantity })
            .eq('id', txItem.item.id);

          if (updateError) {
            throw new Error(t('error_updating_quantity_for', { itemName: txItem.item.name }));
          }
        }

        const { error: transactionError } = await supabase
          .from('transactions')
          .insert([{
            requisition_id: null,
            worker_id: selectionMode === 'worker' ? scannedWorker!.id : null,
            company: selectionMode === 'company' ? selectedCompany : null,
            item_id: txItem.item.id,
            type: txItem.type,
            quantity: txItem.quantity,
            user_id: user.id,
            authorized_by: authorizedBy.trim() || null,
            given_by: givenBy.trim() || null,
            is_broken: txItem.is_broken,
          }]);

        if (transactionError) {
          if (!txItem.is_broken) {
            const { data: currentItem } = await supabase.from('items').select('quantity').eq('id', txItem.item.id).single();
            if (currentItem) {
              await supabase.from('items').update({ quantity: currentItem.quantity - txItem.quantity }).eq('id', txItem.item.id);
            }
          }
          throw new Error(t('error_recording_transaction_for', { itemName: txItem.item.name }));
        }
      }

      dismissToast(toastId);
      showSuccess(t('all_transactions_recorded_successfully'));
      handleDone();

      if (requisitionCreated) {
        navigate('/requisitions');
      }

    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message);
      fetchCompanies();
    }
  };

  const handleDone = () => {
    setWorkerQrCodeInput('');
    setWorkerSearchTerm('');
    setWorkerSearchResults([]);
    setScannedWorker(null);
    setItemBarcodeInput('');
    setItemSearchTerm('');
    setItemSearchResults([]);
    setScannedItem(null);
    setQuantityToChange(1);
    setTransactionType('takeout');
    setAuthorizedBy('');
    setGivenBy('');
    setApplicationLocation('');
    setSelectedCompany(null);
    setSelectionMode('worker');
    setTransactionItems([]);
    showSuccess(t('transaction_session_cleared'));
    queryClient.refetchQueries({ queryKey: ['transactions', user?.id] });
    queryClient.refetchQueries({ queryKey: ['outstandingTakeouts', user?.id] });
  };

  const incrementQuantity = () => {
    setQuantityToChange(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantityToChange(prev => Math.max(1, prev - 1));
  };

  return (
    <React.Fragment>
      <audio ref={audioRef} src={beepSound} preload="auto" />
      <div className={`min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900`}>
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${scanningWorker || scanningItem ? '' : 'hidden'}`}>
          {isWeb ? (
            <>
              <div id={scanningWorker ? "worker-qr-reader" : "item-barcode-reader"} className="w-full max-w-md h-auto aspect-video rounded-lg overflow-hidden min-h-[250px]"></div>
              <Button onClick={scanningWorker ? stopWorkerScan : stopItemScan} className="mt-4" variant="secondary">
                {t('cancel_scan')}
              </Button>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-black opacity-50"></div>
              <div className="relative z-10 text-white text-lg">
                {scanningWorker ? t('scanning_for_qr_code') : t('scanning_for_barcode')}
                <Button onClick={scanningWorker ? stopWorkerScan : stopItemScan} className="mt-4 block mx-auto" variant="secondary">
                  {t('cancel_scan')}
                </Button>
                <Button onClick={toggleTorch} className="mt-2 block mx-auto" variant="outline">
                  <Flashlight className={`mr-2 h-4 w-4 ${isTorchOn ? 'text-yellow-400' : ''}`} />
                  {isTorchOn ? t('turn_flashlight_off') : t('turn_flashlight_on')}
                </Button>
                <p className="text-sm text-white mt-2">{t('position_barcode_horizontally')}</p>
              </div>
            </>
          )}
        </div>

        <Card className={`w-full max-w-md ${scanningWorker || scanningItem ? 'hidden' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-grow text-center">
                <CardTitle className="text-2xl">{t('record_item_transaction')}</CardTitle>
                <CardDescription>{t('scan_worker_then_items')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transaction-form">{t('record_transaction_tab')}</TabsTrigger>
                <TabsTrigger value="outstanding-takeouts">{t('outstanding_takeouts_tab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="transaction-form" className="space-y-6 pt-4">
                <div className="space-y-2 border-b pb-4">
                  <h3 className="text-lg font-semibold">{t('transaction_type')}</h3>
                  <ToggleGroup
                    type="single"
                    value={transactionType}
                    onValueChange={(value: 'takeout' | 'return') => {
                      if (scannedItem?.one_time_use && value === 'return') {
                        showError(t('cannot_set_to_return_one_time_use'));
                        return;
                      }
                      value && setTransactionType(value);
                    }}
                    className="flex justify-center gap-4"
                  >
                    <ToggleGroupItem 
                      value="takeout" 
                      aria-label="Toggle takeout" 
                      className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:dark:bg-red-900 data-[state=on]:dark:text-red-200"
                    >
                      {t('takeout')}
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="return" 
                      aria-label="Toggle return" 
                      disabled={scannedItem?.one_time_use}
                      className="flex-1 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:dark:bg-green-900 data-[state=on]:dark:text-green-200"
                    >
                      {t('return')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-4 border-b pb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Users className="mr-2 h-5 w-5" /> {t('recipient')}
                  </h3>
                  <ToggleGroup
                    type="single"
                    value={selectionMode}
                    onValueChange={(value: 'worker' | 'company') => {
                      if (value) {
                        setSelectionMode(value);
                        handleClearWorker();
                      }
                    }}
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleGroupItem value="worker">{t('worker')}</ToggleGroupItem>
                    <ToggleGroupItem value="company">{t('company')}</ToggleGroupItem>
                  </ToggleGroup>

                  {selectionMode === 'worker' && !scannedWorker && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          placeholder={t('enter_worker_qr_code')}
                          value={workerQrCodeInput}
                          onChange={(e) => setWorkerQrCodeInput(e.target.value)}
                          className="flex-grow"
                        />
                        <Button onClick={startWorkerScan}>
                          <Camera className="mr-2 h-4 w-4" /> {t('scan_worker_qr')}
                        </Button>
                      </div>
                      {workerQrCodeInput && (
                        <Button onClick={() => handleScanWorker(workerQrCodeInput)} className="w-full">
                          <QrCode className="mr-2 h-4 w-4" /> {t('search_worker_by_qr')}
                        </Button>
                      )}
                      <div className="text-center text-sm text-muted-foreground my-2">
                        {t('or')}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="text"
                          placeholder={t('enter_worker_name_to_search')}
                          value={workerSearchTerm}
                          onChange={(e) => setWorkerSearchTerm(e.target.value)}
                          className="flex-grow"
                        />
                        <Button onClick={handleSearchWorkerByName}>
                          <Search className="mr-2 h-4 w-4" /> {t('search_worker_by_name')}
                        </Button>
                      </div>
                      {workerSearchResults.length > 0 && (
                        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                          <p className="text-sm font-medium">{t('select_worker_from_results')}:</p>
                          {workerSearchResults.map((worker) => (
                            <Button
                              key={worker.id}
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => handleSelectWorker(worker)}
                            >
                              {worker.name} ({worker.company || t('no_company')})
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {selectionMode === 'worker' && scannedWorker && (
                    <div className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                      <p><strong>{t('name')}:</strong> {scannedWorker.name}</p>
                      <p><strong>{t('company')}:</strong> {scannedWorker.company || 'N/A'}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={handleClearWorker}>
                        {t('change_worker')}
                      </Button>
                    </div>
                  )}
                  {selectionMode === 'company' && (
                    <div className="space-y-2">
                      <Label htmlFor="company-select">{t('select_company')}</Label>
                      <Select onValueChange={setSelectedCompany} value={selectedCompany || ''}>
                        <SelectTrigger id="company-select">
                          <SelectValue placeholder={t('select_a_company')} />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map(company => (
                            <SelectItem key={company} value={company}>{company}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-b pb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Package className="mr-2 h-5 w-5" /> {t('item_information')}
                  </h3>
                  {!scannedItem ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          placeholder={t('enter_item_barcode_manually')}
                          value={itemBarcodeInput}
                          onChange={(e) => setItemBarcodeInput(e.target.value)}
                          className="flex-grow"
                        />
                        <Button onClick={() => handleScanItem()}>
                          <Search className="mr-2 h-4 w-4" /> {t('search_item_by_barcode')}
                        </Button>
                        <Button onClick={startItemScan}>
                          <Camera className="mr-2 h-4 w-4" /> {t('scan_with_camera')}
                        </Button>
                      </div>
                      <div className="text-center text-sm text-muted-foreground my-2">
                        {t('or')}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="text"
                          placeholder={t('enter_item_name_to_search')}
                          value={itemSearchTerm}
                          onChange={(e) => setItemSearchTerm(e.target.value)}
                          className="flex-grow"
                        />
                        <Button onClick={handleSearchItemByName}>
                          <Search className="mr-2 h-4 w-4" /> {t('search_item_by_name')}
                        </Button>
                      </div>
                      {itemSearchResults.length > 0 && (
                        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                          <p className="text-sm font-medium">{t('select_item_from_results')}:</p>
                          {itemSearchResults.map((item) => (
                            <Tooltip key={item.id}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => handleSelectItem(item)}
                                >
                                  {item.name} ({item.barcode || t('no_barcode')})
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{item.description || t('no_description')}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="border p-3 rounded-md space-y-2 bg-gray-50 dark:bg-gray-800">
                      <h4 className="text-md font-semibold">{scannedItem.name}</h4>
                      <p><strong>{t('description')}:</strong> {scannedItem.description || 'N/A'}</p>
                      <p><strong>{t('current_quantity')}:</strong> {scannedItem.quantity}</p>
                      <p><strong>{t('barcode')}:</strong> {scannedItem.barcode}</p>
                      {scannedItem.one_time_use && (
                        <p className="text-sm text-red-500 font-semibold">{t('this_is_one_time_use_item')}</p>
                      )}
                      {scannedItem.is_tool && (
                        <p className="text-sm text-blue-500 font-semibold">{t('this_is_a_tool')}</p>
                      )}

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="quantityToChange">{t('quantity_to_change', { type: transactionType === 'takeout' ? t('take') : t('return') })}:</Label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantityToChange <= 1}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          {/* @ts-ignore */}
                          <Input
                            id="quantityToChange"
                            type="number"
                            value={quantityToChange}
                            onChange={(e) => setQuantityToChange(parseInt(e.target.value) || 1)}
                            min="1"
                            className="text-center"
                          />
                          <Button variant="outline" size="icon" onClick={incrementQuantity}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {transactionType === 'return' && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Switch id="is-broken" checked={isBroken} onCheckedChange={setIsBroken} />
                          <Label htmlFor="is-broken">{t('mark_as_broken')}</Label>
                        </div>
                      )}
                      <Button onClick={handleAddItemToList} className="w-full mt-2">
                        {t('add_item_to_list')}
                      </Button>
                      <Button variant="outline" size="sm" className="mt-2" onClick={handleClearItem}>
                        {t('change_item')}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-b pb-4">
                  <h3 className="text-lg font-semibold">{t('transaction_details')}</h3>
                  <div className="space-y-2">
                    <Label htmlFor="authorizedBy">{t('authorized_by')}</Label>
                    <Input
                      id="authorizedBy"
                      type="text"
                      placeholder={t('enter_authorizer_name')}
                      value={authorizedBy}
                      onChange={(e) => setAuthorizedBy(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="givenBy">{t('given_by')}</Label>
                    <Input
                      id="givenBy"
                      type="text"
                      placeholder={t('enter_giver_name')}
                      value={givenBy}
                      onChange={(e) => setGivenBy(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="applicationLocation">{t('application_location')}</Label>
                    <Input
                      id="applicationLocation"
                      type="text"
                      placeholder={t('enter_application_location')}
                      value={applicationLocation}
                      onChange={(e) => setApplicationLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">{t('transaction_list')}</h3>
                  {transactionItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('no_items_added_yet')}</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {transactionItems.map((txItem, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                          <div>
                            <p className="font-medium">{txItem.item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t(txItem.type)}: {txItem.quantity}
                              {txItem.is_broken && <Badge variant="destructive" className="ml-2">{t('broken')}</Badge>}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItemFromList(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button onClick={handleFinalizeTransactions} className="w-full" disabled={transactionItems.length === 0 || (!scannedWorker && !selectedCompany)}>
                    {t('finalize_transactions')}
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleDone} className="w-full">
                    {t('done_with_current_transaction')}
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold flex items-center">
                    <HistoryIcon className="mr-2 h-5 w-5" /> {t('recent_transaction_history')}
                  </h3>
                  {isHistoryLoading ? (
                    <p className="text-gray-500">{t('loading_history')}</p>
                  ) : transactionsHistory && transactionsHistory.length > 0 ? (
                    <div className="space-y-2">
                      {transactionsHistory.map((transaction) => (
                        <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                          <p><strong>{t('recipient')}:</strong> {transaction.workers?.name || transaction.company || 'N/A'}</p>
                          <p><strong>{t('item')}:</strong> {transaction.items?.name || 'N/A'}</p>
                          <p>
                            <strong>{t('type')}:</strong>{' '}
                            <span
                              className={`font-medium px-2 py-1 rounded-full text-xs ${
                                transaction.type === 'takeout'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                              }`}
                            >
                              {t(transaction.type)}
                            </span>
                          </p>
                          <p><strong>{t('quantity')}:</strong> {transaction.quantity}</p>
                          {transaction.authorized_by && <p><strong>{t('authorized_by')}:</strong> {transaction.authorized_by}</p>}
                          {transaction.given_by && <p><strong>{t('given_by')}:</strong> {transaction.given_by}</p>}
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">{t('no_recent_transactions')}</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="outstanding-takeouts" className="space-y-6 pt-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <HistoryIcon className="mr-2 h-5 w-5" /> {t('outstanding_takeouts_title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('outstanding_takeouts_description')}
                </p>
                {isOutstandingLoading ? (
                  <p className="text-gray-500">{t('loading_outstanding_takeouts')}</p>
                ) : outstandingTakeouts && outstandingTakeouts.length > 0 ? (
                  <div className="space-y-2">
                    {outstandingTakeouts.map((transaction) => (
                      <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                        <p><strong>{t('recipient')}:</strong> {transaction.workers?.name || transaction.company || 'N/A'}</p>
                        <p><strong>{t('item')}:</strong> {transaction.items?.name || 'N/A'}</p>
                        <p><strong>{t('quantity')}:</strong> {transaction.quantity}</p>
                        {transaction.authorized_by && <p><strong>{t('authorized_by')}:</strong> {transaction.authorized_by}</p>}
                        {transaction.given_by && <p><strong>{t('given_by')}:</strong> {transaction.given_by}</p>}
                        <p className="text-xs text-gray-500">
                          {t('taken_on')}: {new Date(transaction.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">{t('no_outstanding_takeouts')}</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </React.Fragment>
  );
};

export default WorkerTransaction;