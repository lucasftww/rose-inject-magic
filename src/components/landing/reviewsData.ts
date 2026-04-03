// Shared reviews data — single source of truth for mobile + desktop

interface Review {
  name: string;
  text: string;
  rating: number;
}

export const reviews: Review[] = [
  { name: "lucas", text: "mano melhor loja que ja comprei, entrega na hora e suporte responde rapido demais. recomendo", rating: 5 },
  { name: "breno", text: "conta veio certinha com todas as skin, ja e minha terceira compra aqui e nunca deu problema", rating: 5 },
  { name: "rafael", text: "tava com medo de ser scam mas entregaram tudo certinho, suporte me ajudou em tudo. confia!", rating: 5 },
  { name: "kaua", text: "inject cs ta rodando liso demais, sem ban nenhum. atualizaram rapido depois do update da valve", rating: 5 },
  { name: "gabriel", text: "comprei a conta e recebi na hora pelo discord, preco justo e qualidade braba", rating: 5 },
  { name: "enzo", text: "ja uso o inject faz 3 meses e zero problema. suporte respondeu em 5 min quando precisei, mt bom", rating: 5 },
  { name: "thiago", text: "mlk melhor cheat de cs2 do mercado, roda suave e indetectavel. virei cliente fiel da royal!", rating: 5 },
  { name: "davi", text: "comprei pra testar e fiquei impressionado, aimbot muito smooth ninguem percebe kkkkk", rating: 4 },
  { name: "juliana", text: "ja sou cliente faz tempo, nunca tive problema. confianca total nessa loja", rating: 5 },
];
