import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TFunction } from 'i18next';

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

export const exportToPdf = (data: RequisitionData) => {
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
  doc.text(t('csv_header_title'), pageWidth / 2, 20, { align: 'center' });

  // Header Info
  doc.setFontSize(10);
  const headerY = 30;
  doc.text(`${t('csv_header_date')} ${new Date().toLocaleDateString()}`, 14, headerY);
  doc.text(`${t('csv_header_req_no')} ${requisitionNumber}`, pageWidth - 14, headerY, { align: 'right' });

  doc.text(`${t('csv_header_auth')} ${authorizedBy || 'N/A'}`, 14, headerY + 7);

  doc.text(`${t('csv_header_requester')} ${requester || 'N/A'}`, 14, headerY + 14);
  doc.text(`${t('csv_header_company')} ${company || 'N/A'}`, pageWidth - 14, headerY + 14, { align: 'right' });

  // Table
  const tableColumn = [
    t('csv_col_qty'),
    t('csv_col_material'),
    t('csv_col_app_location'),
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
  doc.save(filename);
};