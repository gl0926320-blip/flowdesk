export default function BillingPage() {
  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6">Assinatura</h1>

      <div className="bg-gray-900 p-6 rounded mb-6">
        <h2 className="text-lg mb-2">Plano Atual</h2>
        <p className="text-gray-400">Plano Free</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 p-6 rounded">
          <h2 className="text-lg mb-2">Plano Free</h2>
          <ul className="text-gray-400 mb-4">
            <li>✔ Até 10 serviços</li>
            <li>✔ Dashboard básico</li>
          </ul>
          <button className="bg-gray-700 px-4 py-2 rounded">
            Plano Atual
          </button>
        </div>

        <div className="bg-purple-900 p-6 rounded border border-purple-500">
          <h2 className="text-lg mb-2">Plano Pro</h2>
          <ul className="text-gray-200 mb-4">
            <li>✔ Serviços ilimitados</li>
            <li>✔ Métricas avançadas</li>
            <li>✔ Exportação PDF</li>
          </ul>
          <button className="bg-purple-600 px-4 py-2 rounded">
            Assinar Plano Pro
          </button>
        </div>
      </div>
    </div>
  )
}