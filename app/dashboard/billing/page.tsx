"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { Crown, Users, Building2, BarChart3, GraduationCap } from "lucide-react"

export default function BillingPage(){

const supabase = createClient()

const [plan,setPlan] = useState<string>("free")
const [loading,setLoading] = useState(true)

useEffect(()=>{

async function loadPlan(){

const { data:{user} } = await supabase.auth.getUser()

if(!user){
setLoading(false)
return
}

const { data } = await supabase
.from("profiles")
.select("plan")
.eq("id",user.id)
.single()

if(data?.plan){
setPlan(data.plan)
}

setLoading(false)

}

loadPlan()

},[])

function gerarWhatsapp(plano:string,preco:string){

const texto = `Olá! Quero contratar o plano ${plano} do FlowDesk.

Plano: ${plano}
Valor: R$ ${preco}/mês

Gostaria de ativar para minha empresa.`

return `https://wa.me/5562994693465?text=${encodeURIComponent(texto)}`

}

if(loading){
return(
<div className="flex items-center justify-center h-[60vh] text-white">
Carregando plano...
</div>
)
}

return (

<div className="p-10 text-white max-w-7xl mx-auto space-y-16">

<div>
<h1 className="text-4xl font-bold flex gap-3">
<Crown className="text-yellow-400"/>
Planos FlowDesk
</h1>

<p className="text-gray-400 mt-3 max-w-2xl">
O FlowDesk foi criado para organizar toda operação comercial
de pequenas e médias empresas em um único sistema.
</p>
</div>

{/* FEATURES */}

<div className="grid md:grid-cols-4 gap-6">

<Feature icon={<BarChart3/>}
title="Inteligência Comercial"
desc="Métricas de conversão, faturamento e performance da equipe."/>

<Feature icon={<Users/>}
title="Gestão de Equipe"
desc="Controle vendedores, metas e performance."/>

<Feature icon={<Building2/>}
title="Multiempresa"
desc="Gerencie várias empresas em um único painel."/>

<Feature icon={<GraduationCap/>}
title="FlowDesk Academy"
desc="Treinamento estratégico para implantação do CRM."/>

</div>

{/* PLANOS */}

<div className="grid md:grid-cols-5 gap-6">

<Card
title="Free"
price="0"
users="1 usuário"
empresas="1 empresa"
servicos="5 serviços"
features={[
"CRM básico",
"Pipeline simples",
"Dashboard básico"
]}
current={plan==="free"}
link={gerarWhatsapp("Free","0")}
/>

<Card
title="Starter"
price="69,90"
users="1 usuário"
empresas="1 empresa"
servicos="Ilimitado"
features={[
"CRM completo",
"Pipeline avançado",
"Orçamentos ilimitados",
"Exportação PDF"
]}
current={plan==="starter"}
link={gerarWhatsapp("Starter","69,90")}
/>

<Card
title="Growth"
price="149,90"
users="3 usuários"
empresas="2 empresas"
servicos="Ilimitado"
features={[
"Gestão de equipe",
"Controle de leads",
"Métricas de vendas",
"Comissões"
]}
current={plan==="growth"}
link={gerarWhatsapp("Growth","149,90")}
/>

<Card
title="Scale"
price="239,90"
users="5 usuários"
empresas="3 empresas"
servicos="Ilimitado"
features={[
"Equipe completa",
"Ranking vendedores",
"Dashboard avançado",
"Suporte prioritário"
]}
current={plan==="scale"}
link={gerarWhatsapp("Scale","239,90")}
/>

<Card
title="Pro"
price="449,90"
users="10 usuários"
empresas="5 empresas"
servicos="Ilimitado"
features={[
"Multiempresa avançado",
"Alertas estratégicos",
"Analytics avançado",
"FlowDesk Academy"
]}
recommended
current={plan==="pro"}
link={gerarWhatsapp("Pro","449,90")}
/>

</div>

</div>

)

}

function Feature({icon,title,desc}:any){

return(

<div className="bg-[#111827] p-6 rounded-2xl border border-white/10">

<div className="text-purple-400 mb-3">
{icon}
</div>

<h3 className="font-semibold mb-2">
{title}
</h3>

<p className="text-sm text-gray-400">
{desc}
</p>

</div>

)

}

function Card({title,price,users,empresas,servicos,features,recommended,current,link}:any){

return(

<div className={`p-6 rounded-2xl border ${recommended ? "border-purple-500 bg-purple-900/30":"border-gray-700 bg-gray-900"}`}>

{recommended && (
<div className="text-xs bg-purple-600 px-2 py-1 rounded mb-3 w-fit">
Recomendado
</div>
)}

<h2 className="text-xl font-bold mb-3">
{title}
</h2>

<p className="text-3xl font-bold mb-4">
R$ {price}
<span className="text-sm text-gray-400"> /mês</span>
</p>

<ul className="text-sm text-gray-400 space-y-2 mb-6">

<li>👤 {users}</li>
<li>🏢 {empresas}</li>
<li>📄 {servicos}</li>

{features.map((f:any,i:any)=>(
<li key={i}>✔ {f}</li>
))}

</ul>

{current ? (

<button className="w-full bg-gray-700 py-2 rounded-lg opacity-60">
Plano atual
</button>

) : (

<a
href={link}
target="_blank"
className="block text-center w-full bg-purple-600 py-2 rounded-lg hover:scale-105 transition"
>
Selecionar
</a>

)}

</div>

)

}