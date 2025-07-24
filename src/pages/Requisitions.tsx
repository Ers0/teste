import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { exportToPdf } from '@/utils/pdf';
import { showError } from '@/utils/toast';
import { Requisition } from '@/types';
import { useMemo } from 'react';

const Requisitions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const requisitionsUnsorted = useLiveQuery(() => db.requisitions.toArray(), []);
  const requisitions = useMemo(() => {
    if (!requisitionsUnsorted) return undefined;
    return requisitionsUnsorted.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
    });
  }, [requisitionsUnsorted]);

  const isLoading = requisitions === undefined;

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleDateString();
  };

  const handleDownloadPdf = async (requisition: Requisition) => {
    if (!user) return;

    const transactionItems = await db.transactions.where({ requisition_id: requisition.id }).toArray();
    const populatedItems = await Promise.all(transactionItems.map(async (ti) => {
      const item = await db.items.get(ti.item_id);
      return {
        item: { name: item?.name || 'N/A' },
        quantity: ti.quantity,
      };
    }));

    await exportToPdf({
      requisitionNumber: requisition.requisition_number,
      authorizedBy: requisition.authorized_by || '',
      requester: requisition.requester_name,
      company: requisition.requester_company,
      applicationLocation: requisition.application_location || '',
      transactionItems: populatedItems,
      pdf_header_title: t('pdf_header_title'),
      pdf_header_date: t('pdf_header_date'),
      pdf_header_req_no: t('pdf_header_req_no'),
      pdf_header_auth: t('pdf_header_auth'),
      pdf_header_requester: t('pdf_header_requester'),
      pdf_header_company: t('pdf_header_company'),
      pdf_col_qty: t('pdf_col_qty'),
      pdf_col_material: t('pdf_col_material'),
      pdf_col_app_location: t('pdf_col_app_location'),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_requisitions')}</p>
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
                      <TableCell className="text-right">{safeFormatDate(req.created_at)}</TableCell>
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