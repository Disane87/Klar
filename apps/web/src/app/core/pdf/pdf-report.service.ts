import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FixedCostGroup } from '../overview/overview.service';

export interface FixkostenPdfData {
  groups: FixedCostGroup[];
  incomeTotalCents: number;
  expenseTotalCents: number;
  surplusCents: number;
  householdName: string;
  month: string;
  expenseRatio: number | null;
  surplusRatio: number | null;
  expenseRating: string;
  surplusRating: string;
  incomeBracket: { label: string; desc: string };
  showCreator: boolean;
}

@Injectable({ providedIn: 'root' })
export class PdfReportService {

  exportFixkosten(data: FixkostenPdfData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;
    let y = 0;

    // ── Colors ──────────────────────────────────────────────────────────────────
    const BLACK = '#1a1a1e';
    const RED = '#e63946';
    const GREEN = '#2a9d8f';
    const MUTED = '#6b7280';
    const BORDER = '#d1d5db';

    // ── Month label ─────────────────────────────────────────────────────────────
    const monthLabel = this.formatMonth(data.month);

    // ── Title ────────────────────────────────────────────────────────────────────
    y = 20;
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK);
    doc.text('Klar', marginL, y);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED);
    doc.text(`${data.householdName}  ·  ${monthLabel}`, marginL + 28, y - 1);

    // ── Divider ─────────────────────────────────────────────────────────────────
    y += 4;
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.4);
    doc.line(marginL, y, pageW - marginR, y);
    y += 8;

    // ── Summary cards ────────────────────────────────────────────────────────────
    const cardW = (contentW - 6) / 3;
    const cardH = 16;
    const summaryData = [
      { label: 'Einnahmen', value: data.incomeTotalCents, color: GREEN, rating: null, ratingColor: '' },
      { label: 'Ausgaben', value: data.expenseTotalCents, color: RED, rating: data.expenseRating || null, ratingColor: data.expenseRating === 'Sehr gut' || data.expenseRating === 'Gut' ? GREEN : data.expenseRating === 'OK' ? '#38bdf8' : data.expenseRating === 'Knapp' ? '#facc15' : RED },
      { label: 'Überschuss', value: data.surplusCents, color: data.surplusCents >= 0 ? GREEN : RED, rating: data.surplusRating || null, ratingColor: data.surplusRating === 'Sehr gut' || data.surplusRating === 'Gut' ? GREEN : data.surplusRating === 'OK' ? '#38bdf8' : data.surplusRating === 'Knapp' ? '#facc15' : RED },
    ];

    for (let i = 0; i < summaryData.length; i++) {
      const x = marginL + i * (cardW + 3);
      const s = summaryData[i];

      doc.setFillColor('#f9fafb');
      doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F');
      doc.setDrawColor(BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'S');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(MUTED);
      doc.text(s.label.toUpperCase(), x + cardW / 2, y + 4.5, { align: 'center' });

      if (s.label === 'Einnahmen') {
        doc.setFontSize(5.5);
        doc.setTextColor(MUTED);
        doc.text('BRUTTO', x + cardW / 2, y + 7.5, { align: 'center' });
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(s.color);
      doc.text(this.formatCents(s.value), x + cardW / 2, y + 11.5, { align: 'center' });

      // Rating line
      if (s.rating) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(s.ratingColor);
        doc.text(s.rating, x + cardW / 2, y + 15, { align: 'center' });
      }
    }

    // ── Income bracket ─────────────────────────────────────────────────────────
    if (data.incomeBracket && data.incomeBracket.label !== '–') {
      y += cardH + 3;
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(MUTED);
      doc.text(`Einkommensklasse: ${data.incomeBracket.label} (${data.incomeBracket.desc})`, marginL, y);
      y += 5;
    } else {
      y += cardH + 8;
    }

    // ── Grouped tables ──────────────────────────────────────────────────────────
    const typeOrder: Record<string, number> = { INCOME: 0, FIXED_INCOME: 1, EXPENSE: 2 };
    const sortedGroups = [...data.groups].sort((a, b) => {
      const ta = typeOrder[a.categoryType] ?? 9;
      const tb = typeOrder[b.categoryType] ?? 9;
      if (ta !== tb) return ta - tb;
      return (a.categorySortOrder ?? 0) - (b.categorySortOrder ?? 0);
    });

    for (const group of sortedGroups) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // ── Group header ──────────────────────────────────────────────────────────
      doc.setFillColor('#f3f4f6');
      doc.roundedRect(marginL, y, contentW, 7, 1, 1, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLACK);
      doc.text(group.categoryName.toUpperCase(), marginL + 3, y + 4.8);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(group.totalCents >= 0 ? GREEN : RED);
      doc.text(this.formatCents(group.totalCents), pageW - marginR - 3, y + 4.8, { align: 'right' });

      y += 9;

      // ── Items table ───────────────────────────────────────────────────────────
      const rows = group.items.map(item => {
        const base = [
          item.name,
          this.frequencyLabel(item.frequency),
          item.dayOfMonth ? `${String(item.dayOfMonth).padStart(2, '0')}.` : '–',
        ];
        if (data.showCreator) base.push(item.createdBy ?? '–');
        base.push(this.formatCents(item.monthlyEquivalentCents));
        return base;
      });

      const head = data.showCreator
        ? [['Name', 'Frequenz', 'Buchungstag', 'Von', 'Monatsäquivalent']]
        : [['Name', 'Frequenz', 'Buchungstag', 'Monatsäquivalent']];
      const amountColIdx = data.showCreator ? 4 : 3;

      autoTable(doc, {
        startY: y,
        margin: { left: marginL, right: marginR },
        head,
        body: rows,
        theme: 'plain',
        styles: {
          fontSize: 8,
          cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
          lineColor: BORDER,
          lineWidth: 0.15,
          textColor: BLACK,
          font: 'helvetica',
        },
        headStyles: {
          fontSize: 6.5,
          fontStyle: 'bold',
          textColor: MUTED,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
        columnStyles: data.showCreator
          ? {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 24, halign: 'center' },
              2: { cellWidth: 20, halign: 'center' },
              3: { cellWidth: 26, halign: 'left' },
              4: { cellWidth: 34, halign: 'right', font: 'courier' },
            }
          : {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 28, halign: 'center' },
              2: { cellWidth: 22, halign: 'center' },
              3: { cellWidth: 38, halign: 'right', font: 'courier' },
            },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === amountColIdx) {
            const raw = hookData.cell.raw as string;
            if (raw.startsWith('-')) {
              hookData.cell.styles.textColor = RED;
            } else if (raw !== '0,00 €') {
              hookData.cell.styles.textColor = GREEN;
            }
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // ── Footer on every page ────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(MUTED);
      doc.text(
        `Erstellt am ${this.formatToday()}  ·  Klar  ·  Seite ${i} / ${totalPages}`,
        pageW / 2,
        pageH - 8,
        { align: 'center' },
      );
    }

    doc.save(`Klar_Fixkosten_${data.month}_${data.householdName.replace(/\s+/g, '_')}.pdf`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  private formatCents(cents: number): string {
    const abs = Math.abs(cents) / 100;
    const formatted = abs.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = cents < 0 ? '-' : '';
    return `${sign}${formatted} €`;
  }

  private formatMonth(month: string): string {
    const [year, m] = month.split('-');
    const d = new Date(Number(year), Number(m) - 1, 1);
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  private formatToday(): string {
    return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private frequencyLabel(freq: string): string {
    switch (freq) {
      case 'MONTHLY':    return 'Monatl.';
      case 'QUARTERLY':  return 'Quartal';
      case 'YEARLY':     return 'Jährlich';
      case 'CUSTOM_DAYS': return 'Individuell';
      default:            return freq;
    }
  }
}