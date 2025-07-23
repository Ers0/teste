import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TFunction } from 'i18next';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { showSuccess, showError } from '@/utils/toast';

interface TransactionItem {
  item: { name: string };
  quantity: number;
}

interface RequisitionData {
  requisitionNumber: string;
  authorizedBy: string;
  requester: string | null;
  company: string | null;
  applicationLocation: string;
  transactionItems: TransactionItem[];
  t: TFunction;
}

export const exportToPdf = async (data: RequisitionData) => {
  const {
    requisitionNumber,
    authorizedBy,
    requester,
    company,
    applicationLocation,
    transactionItems,
    t,
  } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.text(t('pdf_header_title'), pageWidth / 2, 20, { align: 'center' });

  // Header Info
  doc.setFontSize(10);
  const headerY = 30;
  doc.text(`${t('pdf_header_date')} ${new Date().toLocaleDateString()}`, 14, headerY);
  doc.text(`${t('pdf_header_req_no')} ${requisitionNumber}`, pageWidth - 14, headerY, { align: 'right' });

  doc.text(`${t('pdf_header_auth')} ${authorizedBy || 'N/A'}`, 14, headerY + 7);

  doc.text(`${t('pdf_header_requester')} ${requester || 'N/A'}`, 14, headerY + 14);
  doc.text(`${t('pdf_header_company')} ${company || 'N/A'}`, pageWidth - 14, headerY + 14, { align: 'right' });

  // Table
  const tableColumn = [
    t('pdf_col_qty'),
    t('pdf_col_material'),
    t('pdf_col_app_location'),
  ];
  const tableRows = transactionItems.map(item => [
    item.quantity,
    item.item.name,
    applicationLocation || 'N/A',
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: headerY + 25,
    theme: 'grid',
    headStyles: { fillColor: [22, 160, 133] },
  });

  const filename = `Requisicao_${requisitionNumber}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfData = doc.output('datauristring');
      const base64Data = pdfData.substring(pdfData.indexOf(',') + 1);

      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
      });

      showSuccess(t('pdf_saved_to_documents', { filename }));
    } catch (e: any) {
      console.error('Unable to write file', e);
      showError(`${t('error_saving_pdf')} ${e.message}`);
    }
  } else {
    // Web implementation
    doc.save(filename);
  }
};