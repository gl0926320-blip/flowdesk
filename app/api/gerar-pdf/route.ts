import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function POST(req: Request) {
  const data = await req.json();

  const numeroOS = data.numero_os ?? `OS-${Date.now()}`;
  const cliente = data.cliente ?? "Não informado";
  const servico = data.tipo_servico ?? "Não informado";
  const valor = Number(data.valor_orcamento ?? 0);
  const custo = Number(data.custo ?? 0);
  const lucro = valor - custo;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 🔷 Header FlowDesk
  page.drawRectangle({
    x: 0,
    y: 750,
    width: 600,
    height: 50,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText("FlowDesk", {
    x: 50,
    y: 765,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("ORDEM DE SERVIÇO", {
    x: 350,
    y: 765,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let y = 700;

  function linha(label: string, valor: string | number, isBold = false) {
    page.drawText(`${label}:`, {
      x: 50,
      y,
      size: 12,
      font: fontBold,
    });

    page.drawText(String(valor), {
      x: 180,
      y,
      size: 12,
      font: isBold ? fontBold : fontRegular,
    });

    y -= 30;
  }

  linha("Número", numeroOS);
  linha("Cliente", cliente);
  linha("Serviço", servico);
  linha("Valor", `R$ ${valor.toFixed(2)}`);
  linha("Custo", `R$ ${custo.toFixed(2)}`);
  linha("Lucro", `R$ ${lucro.toFixed(2)}`, true);

  // Linha separadora
  page.drawLine({
    start: { x: 50, y: y - 10 },
    end: { x: 550, y: y - 10 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Rodapé
  page.drawText("Documento gerado automaticamente pelo FlowDesk", {
    x: 50,
    y: 50,
    size: 10,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${numeroOS}.pdf"`,
    },
  });
}