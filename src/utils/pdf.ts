import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  pdf_header_title: string;
  pdf_header_date: string;
  pdf_header_req_no: string;
  pdf_header_auth: string;
  pdf_header_requester: string;
  pdf_header_company: string;
  pdf_col_qty: string;
  pdf_col_material: string;
  pdf_col_app_location: string;
}

export const exportToPdf = async (data: RequisitionData) => {
  const {
    requisitionNumber,
    authorizedBy,
    requester,
    company,
    applicationLocation,
    transactionItems,
    pdf_header_title,
    pdf_header_date,
    pdf_header_req_no,
    pdf_header_auth,
    pdf_header_requester,
    pdf_header_company,
    pdf_col_qty,
    pdf_col_material,
    pdf_col_app_location,
  } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.text(pdf_header_title, pageWidth / 2, 20, { align: 'center' });

  // Header Info
  doc.setFontSize(10);
  const headerY = 30;
  doc.text(`${pdf_header_date} ${new Date().toLocaleDateString()}`, 14, headerY);
  doc.text(`${pdf_header_req_no} ${requisitionNumber}`, pageWidth - 14, headerY, { align: 'right' });

  doc.text(`${pdf_header_auth} ${authorizedBy || 'N/A'}`, 14, headerY + 7);

  doc.text(`${pdf_header_requester} ${requester || 'N/A'}`, 14, headerY + 14);
  doc.text(`${pdf_header_company} ${company || 'N/A'}`, pageWidth - 14, headerY + 14, { align: 'right' });

  // Table
  const tableColumn = [
    pdf_col_qty,
    pdf_col_material,
    pdf_col_app_location,
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

  // Web implementation
  doc.save(filename);
};