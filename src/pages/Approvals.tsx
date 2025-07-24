import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Requisition, RequisitionItem, Item } from '@/types';
import { showSuccess, showError } from '@/utils/toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface PopulatedRequisition extends Requisition {
  items: (RequisitionItem & { itemDetails: Item | undefined })[];
}

const Approvals = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const pendingRequisitions = useLiveQuery(async () => {
    const requisitions = await db.requisitions.where('status').equals('pending').toArray();
    const populatedRequisitions: PopulatedRequisition[] = await Promise.all(
      requisitions.map(async (req) => {
        const reqItems = await db.requisition_items.where('requisition_id').equals(req.id).toArray();
        const populatedItems = await Promise.all(
          reqItems.map(async (ri) => {
            const itemDetails = await db.items.get(ri.item_id);
            return { ...ri, itemDetails };
          })
        );
        return { ...req, items: populatedItems };
      })
    );
    return populatedRequisitions;
  }, []);

  const handleUpdateStatus = async (requisition: PopulatedRequisition, newStatus: 'approved' | 'rejected') => {
    try {
      if (newStatus === 'approved') {
        for (const reqItem of requisition.items) {
          if (!reqItem.itemDetails || reqItem.itemDetails.quantity < reqItem.quantity) {
            showError(t('insufficient_stock_for_approval', { itemName: reqItem.itemDetails?.name || t('unknown_item') }));
            return;
          }
        }
      }

      const updatedRequisition = { ...requisition, status: newStatus };
      // This is a simplified version of the object for Dexie's put method.
      const requisitionToUpdate: Requisition = {
        id: requisition.id,
        requisition_number: requisition.requisition_number,
        user_id: requisition.user_id,
        authorized_by: requisition.authorized_by,
        given_by: requisition.given_by,
        requester_name: requisition.requester_name,
        requester_company: requisition.requester_company,
        application_location: requisition.application_location,
        created_at: requisition.created_at,
        status: newStatus,
      };

      await db.requisitions.put(requisitionToUpdate);
      await db.outbox.add({
        type: 'update',
        table: 'requisitions',
        payload: { id: requisition.id, status: newStatus },
        timestamp: Date.now(),
      });

      showSuccess(t('requisition_status_updated_successfully', { status: t(newStatus) }));
    } catch (error: any) {
      showError(t('error_updating_requisition_status') + error.message);
    }
  };

  const isLoading = pendingRequisitions === undefined;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-3xl font-bold">{t('requisition_approvals')}</CardTitle>
              <CardDescription>{t('review_and_approve_pending_requisitions')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t('loading_pending_requisitions')}</p>
          ) : pendingRequisitions && pendingRequisitions.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-4">
              {pendingRequisitions.map((req) => (
                <AccordionItem value={req.id} key={req.id} className="border rounded-md">
                  <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="flex justify-between w-full items-center">
                      <div>
                        <p className="font-semibold">{t('requisition_number')}: {req.requisition_number}</p>
                        <p className="text-sm text-muted-foreground">{req.requester_name} ({req.requester_company})</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border-t">
                    <div className="space-y-2 mb-4">
                      <p><strong>{t('authorized_by')}:</strong> {req.authorized_by || 'N/A'}</p>
                      <p><strong>{t('given_by')}:</strong> {req.given_by || 'N/A'}</p>
                      <p><strong>{t('application_location')}:</strong> {req.application_location || 'N/A'}</p>
                    </div>
                    <ul className="space-y-2">
                      {req.items.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <span>{item.itemDetails?.name || t('unknown_item')}</span>
                          <span className="font-semibold">{t('quantity')}: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="destructive" size="sm" onClick={() => handleUpdateStatus(req, 'rejected')}>
                        <X className="mr-2 h-4 w-4" /> {t('reject')}
                      </Button>
                      <Button variant="default" size="sm" onClick={() => handleUpdateStatus(req, 'approved')}>
                        <Check className="mr-2 h-4 w-4" /> {t('approve')}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t('no_pending_requisitions')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Approvals;