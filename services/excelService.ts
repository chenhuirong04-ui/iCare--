
import ExcelJS from 'exceljs';
import FileSaver from 'file-saver';
import { QuoteItem, QuoteMetadata, RFQProduct, RFQMetadata, SessionImage } from '../types';

const COMPANY = {
  name: 'GLOBALCARE INFO GENERAL TRADING FZCO',
  email: 'chrischen1579@gmail.com',
  phone: '+971 58 556 6809',
  address: 'Dubai Silicon Oasis, DDP, Building A2, Dubai, UAE',
};

export const generateGCIExcel = async (items: QuoteItem[], metadata: QuoteMetadata) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(metadata.type);

  // Styling
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  const accentColor = 'FF0EA5E9';
  const goldColor = 'FFD4AF37';

  // --- HEADER & BRANDING ---
  sheet.addRow([COMPANY.name]);
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: accentColor } };
  sheet.mergeCells('A1:J1');

  sheet.addRow([`${COMPANY.address} | Email: ${COMPANY.email} | Tel: ${COMPANY.phone}`]);
  sheet.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };
  sheet.mergeCells('A2:J2');

  sheet.addRow([]);
  const titleRow = sheet.addRow([metadata.type.toUpperCase()]);
  titleRow.getCell(1).font = { bold: true, size: 24, color: { argb: 'FF0F172A' } };
  titleRow.height = 40;
  sheet.mergeCells(`A${titleRow.number}:J${titleRow.number}`);
  sheet.addRow([]);

  // --- DOCUMENT INFO ---
  sheet.addRow(['BILL TO / 客户：', '', '', '', '', 'DOC INFO / 单据信息：']).font = { bold: true, size: 10 };
  sheet.addRow([`Customer: ${metadata.customerName}`, '', '', '', '', `${metadata.type} No:`, metadata.quoteNo]);
  sheet.addRow([`Attn: ${metadata.customerContact || '-'}`, '', '', '', '', `Date:`, metadata.date]);
  sheet.addRow([`Phone: ${metadata.customerPhone || '-'}`, '', '', '', '', `Validity:`, metadata.validity]);
  sheet.addRow([]);

  // --- TABLE HEADERS ---
  const headers = ['NO.', 'DESCRIPTION (品名规格)', 'SPECS', 'QTY', 'UNIT', 'UNIT PRICE', 'AMOUNT', 'CURRENCY', 'REMARK'];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNum) => {
    cell.fill = headerFill;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // --- TABLE CONTENT ---
  items.forEach((it, i) => {
    const row = sheet.addRow([
      i + 1,
      it.productNameCn,
      it.specs || '-',
      it.quantity,
      it.unit,
      it.gciPrice,
      it.amount,
      metadata.currency,
      it.notes || '-'
    ]);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'left', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const saveAs = (FileSaver as any).saveAs || FileSaver;
  saveAs(new Blob([buffer]), `${metadata.quoteNo}_GCI_${metadata.type}.xlsx`);
};

/**
 * RFQ 询盘清单导出服务 (面向中国供应商优化版)
 * 包含产品图片、详细参数锁定区及供应商高亮填写区。
 */
export const generateRFQExcel = async (products: RFQProduct[], metadata: RFQMetadata, images?: SessionImage[]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('采购询盘清单');

  // 1. 企业品牌头 (Branding)
  sheet.addRow([COMPANY.name]);
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0EA5E9' } };
  
  sheet.addRow(['PROCUREMENT INQUIRY / 采购询盘确认单']);
  sheet.getCell('A2').font = { bold: true, size: 18 };
  
  sheet.addRow([`询盘单号: ${metadata.rfqNo}`]);
  sheet.addRow([`目标市场: ${metadata.targetMarket || '全球'}`]);
  sheet.addRow([`询盘说明: ${metadata.notes || '无'}`]);
  
  // 2. 指令说明 (Instruction)
  sheet.addRow([]);
  const instructionRow = sheet.addRow(['【填写指南】请供应商仅在黄色高亮区域填写报价信息，填写完成后请原样回传此 Excel 文件。其余单元格已锁定，请勿修改。']);
  instructionRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' } };
  sheet.addRow([]);

  // 3. 表头定义
  // A: 序号, B: 产品图片, C: 品名(CN), D: 材质/等级, E: 规格/尺寸, F: 包装形式, G: 每箱数量, H: 外箱尺寸, I: 外箱体积, J: 毛重, K: 净重, L: 询价数量, M: 单位, N: 产品备注
  // O: 单价(必填), P: 币种, Q: 最小起订量(MOQ), R: 生产交期(天), S: 报价有效期, T: 供应商备注
  const headers = [
    '序号', '产品图片', '产品名称(CN)', '材质/等级', '规格/尺寸', '包装形式', 
    '每箱数量', '外箱尺寸(cm)', '外箱体积(CBM)', '毛重(kg)', '净重(kg)', 
    '需求数量', '单位', '产品备注',
    '单价(必填)', '币种(RMB/USD)', '最小起订量(MOQ)', '生产交期(天)', '报价有效期', '供应商备注'
  ];
  
  const headerRow = sheet.addRow(headers);
  headerRow.height = 30;
  
  // 样式设置
  const readOnlyFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
  const supplierFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // 黄色高亮
  const textWhite = { color: { argb: 'FFFFFFFF' }, bold: true };
  const textDark = { color: { argb: 'FF000000' }, bold: true };

  headerRow.eachCell((cell, colNumber) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    if (colNumber <= 14) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.font = textWhite;
    } else {
      cell.fill = supplierFill;
      cell.font = textDark;
    }
  });

  // 4. 数据行填充
  products.forEach((p, i) => {
    const rowValues = [
      i + 1,
      '', // 图片占位 (B)
      p.productNameCn || '-',
      p.material || '-',
      p.specs || '-',
      p.packaging || '-',
      p.pcsPerCtn || '-',
      p.ctnSize || '-',
      p.cbm || '-',
      p.gw || '-',
      p.nw || '-',
      p.quantity || '-',
      p.unit || 'pcs',
      p.productNotes || '-',
      '', '', '', '', '', '' // O-T 为空供填写
    ];
    
    const row = sheet.addRow(rowValues);
    row.height = 80; // 为图片预留高度
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // 高亮供应商填写区
    for (let col = 15; col <= 20; col++) {
      row.getCell(col).fill = supplierFill;
    }
    
    // 如果有图片，尝试插入 (基于 base64)
    if (images && images[i]) {
      try {
        const imageId = workbook.addImage({
          base64: images[i].data,
          extension: images[i].mimeType.split('/')[1] as any,
        });
        sheet.addImage(imageId, {
          tl: { col: 1.1, row: row.number - 1.1 },
          ext: { width: 100, height: 100 }
        });
      } catch (err) {
        console.warn("Excel Image Insertion Failed:", err);
      }
    }
  });

  // 列宽优化
  sheet.columns = [
    { width: 6 },  // A: 序号
    { width: 15 }, // B: 图片
    { width: 30 }, // C: 品名
    { width: 15 }, // D: 材质
    { width: 20 }, // E: 规格
    { width: 15 }, // F: 包装
    { width: 10 }, // G: 装箱数
    { width: 20 }, // H: 箱规
    { width: 12 }, // I: 体积
    { width: 10 }, // J: 毛重
    { width: 10 }, // K: 净重
    { width: 10 }, // L: 数量
    { width: 8 },  // M: 单位
    { width: 20 }, // N: 备注
    { width: 15 }, // O: 单价
    { width: 12 }, // P: 币种
    { width: 15 }, // Q: MOQ
    { width: 15 }, // R: 交期
    { width: 15 }, // S: 有效期
    { width: 25 }, // T: 供应商备注
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const saveAs = (FileSaver as any).saveAs || FileSaver;
  saveAs(new Blob([buffer]), `RFQ_${metadata.rfqNo}_询盘单.xlsx`);
};

export const generateQuotationExcel = async (i: any, m: any) => {};
export const generateSupplierExcel = async (s: any) => {};
