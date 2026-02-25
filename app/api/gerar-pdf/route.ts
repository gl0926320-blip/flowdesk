import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function POST(req: Request) {
  const data = await req.json();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("ORDEM DE SERVIÇO", {
    x: 200,
    y: 750,
    size: 20,
    font,
  });

  page.drawText(`Número: ${data.numero_os}`, { x: 50, y: 700, font });
  page.drawText(`Cliente: ${data.cliente}`, { x: 50, y: 670, font });
  page.drawText(`Serviço: ${data.tipo_servico}`, { x: 50, y: 640, font });
  page.drawText(`Valor: R$ ${data.valor_orcamento}`, { x: 50, y: 610, font });
  page.drawText(`Custo: R$ ${data.custo}`, { x: 50, y: 580, font });

  const pdfBytes = await pdfDoc.save();

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}