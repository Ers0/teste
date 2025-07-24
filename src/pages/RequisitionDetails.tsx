import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportToPdf } from '@/utils/pdf';
import { showError } from '@/utils/toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Requisition } from '@/types';

const RequisitionDetails = () => {
  const { t } = useTranslation();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();

  const requisition = useLiveQuery(() => requisitionId ? db.requisitions.get(requisitionId) : undefined, [requisitionId]);
  
  const transactionItems = useLiveQuery(async () => {
    if (!requisitionId) return [];
    const transactions = await db.transactions.where({ requisition_id: requisitionId }).toArray();
    return Promise.all(transactions.map(async (ti) => {
      const item = await db.items.get(ti.item_id);
      return {
        ...ti,
        items: item ? [{ name: item.name }] : null,
      };
    }));
  }, [requisitionId]);

  const isLoading = requisition === undefined || transactionItems === undefined;

  const safeFormatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleString();
  };

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
        item: { name: ti.items?.[0]?.name || 'N/A' },
        quantity: ti.quantity,
      })),
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
        <p className="text-gray-600 dark:text-gray-400">{t('loading_requisition_details')}</p>
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
            <div><strong>{t('date')}:</strong> {safeFormatDateTime(requisition.created_at)}</div>
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
                      <TableCell className="font-medium">{item.items?.[0]?.name || 'N/A'}</TableCell>
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