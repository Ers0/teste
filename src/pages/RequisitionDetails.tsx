import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download } from 'lucide-react';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { exportToPdf } from '@/utils/pdf';
import { showError } from '@/utils/toast';

interface RequisitionDetailsData {
  id: string;
  requisition_number: string;
  requester_name: string | null;
  requester_company: string | null;
  authorized_by: string | null;
  given_by: string | null;
  application_location: string | null;
  created_at: string;
}

interface TransactionItem {
  quantity: number;
  items: { name: string } | null;
}

const RequisitionDetails = () => {
  const { t } = useTranslation();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: requisition, isLoading: isLoadingRequisition, error: requisitionError } = useQuery<RequisitionDetailsData, Error>({
    queryKey: ['requisition', requisitionId, user?.id],
    queryFn: async () => {
      if (!requisitionId || !user) throw new Error('Requisition ID or user missing');
      const { data, error } = await supabase
        .from('requisitions')
        .select('*')
        .eq('id', requisitionId)
        .eq('user_id', user.id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!requisitionId && !!user,
  });

  const { data: transactionItems, isLoading: isLoadingItems, error: itemsError } = useQuery<TransactionItem[], Error>({
    queryKey: ['requisitionItems', requisitionId, user?.id],
    queryFn: async () => {
      if (!requisitionId || !user) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('quantity, items(name)')
        .eq('requisition_id', requisitionId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data as TransactionItem[];
    },
    enabled: !!requisitionId && !!user,
  });

  const handleDownloadPdf = async () => {
    if (!requisition || !transactionItems) {
      showError(t('requisition_data_not_loaded'));
      return;
    }
    await exportToPdf({
      requisitionNumber: requisition.requisition_number,
      authorizedBy: requisition.authorized_by || '',
      requester: requisition.requester_name,
      company: requisition.requester_company,
      applicationLocation: requisition.application_location || '',
      transactionItems: transactionItems.map(ti => ({
        item: { name: (Array.isArray(ti.items) ? ti.items[0]?.name : ti.items?.name) || 'N/A' },
        quantity: ti.quantity,
      })),
      t,
    });
  };

  if (isLoadingRequisition || isLoadingItems) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_requisition_details')}</p>
      </div>
    );
  }

  if (requisitionError || itemsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-red-500">{t('error_loading_requisition_details')}: {requisitionError?.message || itemsError?.message}</p>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p>{t('requisition_not_found')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('requisition_details_title')}</CardTitle>
              <CardDescription>{t('requisition_number')}: {requisition.requisition_number}</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
            <div><strong>{t('date')}:</strong> {new Date(requisition.created_at).toLocaleString()}</div>
            <div><strong>{t('requester')}:</strong> {requisition.requester_name || 'N/A'}</div>
            <div><strong>{t('company')}:</strong> {requisition.requester_company || 'N/A'}</div>
            <div><strong>{t('authorized_by')}:</strong> {requisition.authorized_by || 'N/A'}</div>
            <div><strong>{t('given_by')}:</strong> {requisition.given_by || 'N/A'}</div>
            <div><strong>{t('application_location')}:</strong> {requisition.application_location || 'N/A'}</div>
          </div>

          <h4 className="text-lg font-semibold mb-2">{t('items')}</h4>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('item_name')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionItems && transactionItems.length > 0 ? (
                  transactionItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{(Array.isArray(item.items) ? item.items[0]?.name : item.items?.name) || 'N/A'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-gray-500">
                      {t('no_items_found_for_requisition')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequisitionDetails;