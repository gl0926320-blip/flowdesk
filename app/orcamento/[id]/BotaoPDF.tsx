"use client"

export default function BotaoPDF({ data }: any) {

  const gerarPDF = async () => {

    const response = await fetch("/api/gerar-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    window.open(url, "_blank")
  }

  return (
    <button
      onClick={gerarPDF}
      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
    >
      Baixar PDF
    </button>
  )
}