import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download } from 'lucide-react';
import { useIntl } from 'react-intl';
import { exportToPdf } from '@/utils/pdf';
import { showError } from '@/utils/toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Requisition } from '@/types';

const RequisitionDetails = () => {
  const intl = useIntl();
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
      showError(intl.formatMessage({ id: 'requisition_data_not_loaded' }));
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
      pdf_header_title: intl.formatMessage({ id: 'pdf_header_title' }),
      pdf_header_date: intl.formatMessage({ id: 'pdf_header_date' }),
      pdf_header_req_no: intl.formatMessage({ id: 'pdf_header_req_no' }),
      pdf_header_auth: intl.formatMessage({ id: 'pdf_header_auth' }),
      pdf_header_requester: intl.formatMessage({ id: 'pdf_header_requester' }),
      pdf_header_company: intl.formatMessage({ id: 'pdf_header_company' }),
      pdf_col_qty: intl.formatMessage({ id: 'pdf_col_qty' }),
      pdf_col_material: intl.formatMessage({ id: 'pdf_col_material' }),
      pdf_col_app_location: intl.formatMessage({ id: 'pdf_col_app_location' }),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{intl.formatMessage({ id: 'loading_requisition_details' })}</p>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p>{intl.formatMessage({ id: 'requisition_not_found' })}</p>
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
              <CardTitle className="text-3xl font-bold">{intl.formatMessage({ id: 'requisition_details_title' })}</CardTitle>
              <CardDescription>{intl.formatMessage({ id: 'requisition_number' })}: {requisition.requisition_number}</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
            <div><strong>{intl.formatMessage({ id: 'date' })}:</strong> {safeFormatDateTime(requisition.created_at)}</div>
            <div><strong>{intl.formatMessage({ id: 'requester' })}:</strong> {requisition.requester_name || 'N/A'}</div>
            <div><strong>{intl.formatMessage({ id: 'company' })}:</strong> {requisition.requester_company || 'N/A'}</div>
            <div><strong>{intl.formatMessage({ id: 'authorized_by' })}:</strong> {requisition.authorized_by || 'N/A'}</div>
            <div><strong>{intl.formatMessage({ id: 'given_by' })}:</strong> {requisition.given_by || 'N/A'}</div>
            <div><strong>{intl.formatMessage({ id: 'application_location' })}:</strong> {requisition.application_location || 'N/A'}</div>
          </div>

          <h4 className="text-lg font-semibold mb-2">{intl.formatMessage({ id: 'items' })}</h4>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{intl.formatMessage({ id: 'item_name' })}</TableHead>
                  <TableHead className="text-right">{intl.formatMessage({ id: 'quantity' })}</TableHead>
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
                      {intl.formatMessage({ id: 'no_items_found_for_requisition' })}
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