import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { exportToPdf } from '@/utils/pdf';
import { showError } from '@/utils/toast';

interface Requisition {
  id: string;
  requisition_number: string;
  requester_name: string | null;
  requester_company: string | null;
  created_at: string;
}

const Requisitions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: requisitions, isLoading, error } = useQuery<Requisition[], Error>({
    queryKey: ['requisitions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('requisitions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const handleDownloadPdf = async (requisition: Requisition) => {
    if (!user) return;

    const { data: transactionItems, error: itemsError } = await supabase
      .from('transactions')
      .select('quantity, items(name)')
      .eq('requisition_id', requisition.id)
      .eq('user_id', user.id);

    if (itemsError) {
      showError(t('error_fetching_transaction_items') + itemsError.message);
      return;
    }

    const { data: requisitionDetails, error: requisitionError } = await supabase
      .from('requisitions')
      .select('*')
      .eq('id', requisition.id)
      .single();

    if (requisitionError) {
      showError(t('error_fetching_requisition_details') + requisitionError.message);
      return;
    }

    await exportToPdf({
      requisitionNumber: requisition.requisition_number,
      authorizedBy: requisitionDetails.authorized_by || '',
      requester: requisitionDetails.requester_name,
      company: requisitionDetails.requester_company,
      applicationLocation: requisitionDetails.application_location || '',
      transactionItems: (transactionItems as any[]).map(ti => ({
        item: { name: (Array.isArray(ti.items) ? ti.items[0]?.name : ti.items?.name) || 'N/A' },
        quantity: ti.quantity,
      })),
      t,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_requisitions')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-red-500">{t('error_loading_requisitions')}: {error.message}</p>
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
              <CardTitle className="text-3xl font-bold">{t('requisitions')}</CardTitle>
              <CardDescription>{t('view_and_download_past_requisitions')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('requisition_number')}</TableHead>
                  <TableHead>{t('requester')}</TableHead>
                  <TableHead>{t('company')}</TableHead>
                  <TableHead className="text-right">{t('date')}</TableHead>
                  <TableHead className="text-center">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions && requisitions.length > 0 ? (
                  requisitions.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.requisition_number}</TableCell>
                      <TableCell>{req.requester_name || 'N/A'}</TableCell>
                      <TableCell>{req.requester_company || 'N/A'}</TableCell>
                      <TableCell className="text-right">{new Date(req.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Link to={`/requisition/${req.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              {t('view')}
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(req)}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('download_pdf')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      {t('no_requisitions_found')}
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

export default Requisitions;