"use client"

import { useState } from "react"

export default function ConfiguracoesPage() {
  const [nomeEmpresa, setNomeEmpresa] = useState("")
  const [telefone, setTelefone] = useState("")

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6">Configurações</h1>

      <div className="bg-gray-900 p-6 rounded max-w-xl">
        <div className="mb-4">
          <label className="block mb-2">Nome da Empresa</label>
          <input
            className="w-full p-2 bg-gray-800 rounded"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">Telefone</label>
          <input
            className="w-full p-2 bg-gray-800 rounded"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>

        <button className="bg-purple-600 px-4 py-2 rounded">
          Salvar Alterações
        </button>
      </div>
    </div>
  )
}