import type { Chat, Message } from "./types";

const now = Date.now();
const min = 60_000;

const contacts = [
  { id: "1", name: "Mariana Costa", phone: "+55 65 99812-4471", online: true, about: "Design & café ☕" },
  { id: "2", name: "Equipe Comercial", phone: "+55 65 3322-1100", about: "Grupo" },
  { id: "3", name: "Rafael Almeida", phone: "+55 11 98450-2231", about: "Disponível" },
  { id: "4", name: "Juliana Prado", phone: "+55 21 99701-8890", online: true },
  { id: "5", name: "Carlos Mendes", phone: "+55 65 99230-7712" },
  { id: "6", name: "Fernanda Lima", phone: "+55 31 98877-6655" },
  { id: "7", name: "Suporte Ideal", phone: "+55 65 4000-1234" },
  { id: "8", name: "Pedro Henrique", phone: "+55 48 99654-3321" },
];

const scripts: Record<string, [boolean, string, number][]> = {
  "1": [
    [false, "Oi! Tudo bem? 😊", 180],
    [true, "Tudo ótimo, e com você?", 178],
    [false, "Tudo certo! Conseguiu ver a nova proposta de layout?", 175],
    [true, "Vi sim, ficou muito elegante. Só ajustaria o espaçamento do cabeçalho.", 170],
    [false, "Perfeito, vou ajustar e te mando ainda hoje.", 60],
    [true, "Combinado! Obrigado 🙌", 58],
    [false, "Enviei a versão final, dá uma olhada quando puder", 4],
  ],
  "2": [
    [false, "Bom dia, pessoal! Reunião às 10h.", 300],
    [true, "Confirmado ✅", 290],
    [false, "Meta do mês batida! 🎉", 25],
  ],
  "3": [
    [true, "Rafael, o pedido #4821 já saiu?", 1500],
    [false, "Saiu ontem à tarde, deve chegar amanhã.", 1440],
  ],
  "4": [[false, "Vamos almoçar sexta?", 90]],
  "5": [
    [false, "Pode me enviar o orçamento?", 3000],
    [true, "Claro, segue em anexo.", 2900],
  ],
  "6": [[true, "Feliz aniversário! 🎂", 6000]],
  "7": [[false, "Seu chamado foi resolvido. Avalie nosso atendimento!", 9000]],
  "8": [[false, "Valeu pela ajuda!", 12000]],
};

const unread: Record<string, number> = { "1": 1, "2": 3, "4": 1 };

export const mockMessages: Record<string, Message[]> = Object.fromEntries(
  Object.entries(scripts).map(([chatId, list]) => [
    chatId,
    list.map(([fromMe, body, ago], i) => ({
      id: `${chatId}-${i}`,
      chatId,
      fromMe,
      body,
      timestamp: now - ago * min,
      status: fromMe ? "read" : undefined,
    })),
  ]),
);

export const mockChats: Chat[] = contacts.map((contact) => {
  const msgs = mockMessages[contact.id] ?? [];
  return {
    id: contact.id,
    contact,
    lastMessage: msgs[msgs.length - 1],
    unreadCount: unread[contact.id] ?? 0,
    pinned: contact.id === "2",
    favorite: ["1", "4", "7"].includes(contact.id),
  };
});
