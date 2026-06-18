import { jsPDF } from 'jspdf'
import { NextResponse } from 'next/server'

const REPORT_LABELS: Record<string, string> = {
  kilometrage: 'Kilometraje por vehículo',
  trips: 'Registro de viajes',
  speed: 'Excesos de velocidad',
  alerts: 'Historial de alertas',
  idle: 'Tiempo detenido (ralentí)',
}

const BRAND = { r: 30, g: 64, b: 175 }

export function csvResponse(
  type: string,
  dateFrom: string,
  suffix: string,
  headers: string[],
  rows: string[][],
) {
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${type}${suffix}-${dateFrom}.csv"`,
    },
  })
}

export function pdfResponse(
  type: string,
  dateFrom: string,
  dateTo: string,
  suffix: string,
  headers: string[],
  rows: string[][],
) {
  const landscape = headers.length > 5
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 12
  const label = REPORT_LABELS[type] ?? type
  const generated = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.text('TrackPro GPS', margin, 14)
  doc.setFontSize(9)
  doc.text('trackprogps.mx', pageW - margin, 14, { align: 'right' })

  doc.setTextColor(30, 30, 30)
  doc.setFontSize(11)
  doc.text(label, margin, 32)
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(`Período: ${dateFrom} → ${dateTo}`, margin, 38)
  doc.text(`Generado: ${generated}  |  Registros: ${rows.length}`, margin, 43)

  const colCount = Math.max(headers.length, 1)
  const tableW = pageW - margin * 2
  const colW = tableW / colCount
  let y = 50
  const lineH = 5.5
  const maxY = pageH - 16

  function drawHeaderRow() {
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y - 4, tableW, lineH + 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(30, 30, 30)
    headers.forEach((h, i) => {
      doc.text(String(h).slice(0, 24), margin + i * colW + 1, y)
    })
    y += lineH + 1
    doc.setFont('helvetica', 'normal')
  }

  drawHeaderRow()

  doc.setFontSize(7)
  for (let ri = 0; ri < rows.length; ri++) {
    if (y > maxY) {
      doc.addPage()
      y = margin + 4
      drawHeaderRow()
    }
    if (ri % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 3.5, tableW, lineH, 'F')
    }
    doc.setTextColor(50, 50, 50)
    const row = rows[ri]
    row.forEach((cell, i) => {
      doc.text(String(cell ?? '').slice(0, 28), margin + i * colW + 1, y)
    })
    y += lineH
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Página ${p} de ${pages}`, pageW / 2, pageH - 8, { align: 'center' })
  }

  const buf = doc.output('arraybuffer')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${type}${suffix}-${dateFrom}.pdf"`,
    },
  })
}

export function reportResponse(
  format: string,
  type: string,
  dateFrom: string,
  dateTo: string,
  suffix: string,
  headers: string[],
  rows: string[][],
) {
  if (format === 'pdf') {
    return pdfResponse(type, dateFrom, dateTo, suffix, headers, rows)
  }
  return csvResponse(type, dateFrom, suffix, headers, rows)
}
