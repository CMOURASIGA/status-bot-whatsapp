const express = require("express");
const axios = require("axios");
require("dotenv/config");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function removerHtmlTags(texto) {
  return texto?.replace(/<[^>]*>?/gm, '').trim() || "(Não informado)";
}

function limparTextoMultilinha(texto) {
  return texto?.replace(/\n+/g, '\n').trim() || "(Não informado)";
}

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const estados = {};

const workflowsEstrategicosPorBoard = {
  1: [2],
  2: [3],
  3: [7]
};

async function buscarBoards(headers) {
  const response = await axios.get("https://cnc.kanbanize.com/api/v2/boards", { headers });
  return Array.isArray(response.data) ? response.data : response.data?.data || [];
}

async function buscarCards(headers) {
  const response = await axios.get("https://cnc.kanbanize.com/api/v2/cards", { headers });
  const cards = response.data?.data?.data || [];
  if (!Array.isArray(cards)) {
    throw new Error("Formato inesperado de resposta ao buscar cards");
  }
  return cards;
}

async function buscarStatusProjeto(projetoNome, numero) {
  const headers = {
    apikey: process.env.BUSINESSMAP_API_KEY,
    accept: "application/json"
  };

  if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(projetoNome)) {
    estados[numero] = { etapa: "aguardando_board" };
    const boards = await buscarBoards(headers);
    const listaBoards = boards.map(b => `🔹 ${b.name} (ID ${b.board_id})`).join("\n");
    return `🤖 Tudo bem! Qual equipe deseja consultar?\n${listaBoards}\n\n*Responda com o número do ID da equipe.*`;
  }

  const estadoAtual = estados[numero];
  if (!estadoAtual) return "❌ Envie uma saudação para começar (ex: 'Oi').";

  if (estadoAtual.etapa === "aguardando_board") {
    const boardId = parseInt(projetoNome);
    if (isNaN(boardId)) return "❌ Por favor, envie apenas o número do ID da equipe.";
    estadoAtual.board_id = boardId;
    estadoAtual.etapa = "aguardando_projeto";
    return `Equipe registrada! Agora, me diga o nome do projeto que deseja consultar.`;
  }

  if (estadoAtual.etapa === "aguardando_projeto") {
    let cards = await buscarCards(headers);
    let cardsFiltrados = cards.filter(card =>
      card.board_id === estadoAtual.board_id &&
      normalizarTexto(card.title).includes(normalizarTexto(projetoNome))
    );

    const workflowsPermitidos = workflowsEstrategicosPorBoard[estadoAtual.board_id] || null;
    if (workflowsPermitidos) {
      cardsFiltrados = cardsFiltrados.filter(card => workflowsPermitidos.includes(card.workflow_id));
    }

    if (cardsFiltrados.length === 0) {
      return "❌ Nenhum projeto encontrado com esse nome para essa equipe.";
    } else if (cardsFiltrados.length === 1) {
      const projeto = cardsFiltrados[0];
      estadoAtual.etapa = "aguardando_id";
      estadoAtual.lista_projetos = cardsFiltrados;
      return `Encontrei 1 projeto com esse nome:\n\n🔹 ${projeto.title} (ID ${projeto.card_id})\n\n*Responda com o número do ID do projeto para ver o status completo.*`;
    } else {
      const lista = cardsFiltrados.map(p => `🔹 ${p.title} (ID ${p.card_id})`).join("\n");
      estadoAtual.etapa = "aguardando_id";
      estadoAtual.lista_projetos = cardsFiltrados;
      return `Encontrei vários projetos com esse nome. Qual deseja consultar?\n\n${lista}\n\n*Responda com o número do ID do projeto.*`;
    }
  }

  if (estadoAtual.etapa === "aguardando_id") {
    const id = parseInt(projetoNome);
    const projeto = estadoAtual.lista_projetos.find(p => p.card_id === id);
    if (!projeto) return "❌ ID inválido. Tente novamente com um dos IDs listados.";
    estadoAtual.etapa = "completo";
    return montarStatusProjeto(projeto, headers);
  }

  return "❌ Conversa finalizada. Envie 'oi' para começar novamente.";
}

async function montarStatusProjeto(projeto, headers) {
  let nomeColuna = projeto.column_id || "-";
  try {
    const colunasUrl = `https://cnc.kanbanize.com/api/v2/boards/${projeto.board_id}/columns`;
    const colunasResponse = await axios.get(colunasUrl, { headers });
    const colunas = Array.isArray(colunasResponse.data) ? colunasResponse.data : colunasResponse.data?.data || [];
    const coluna = colunas.find(c => c.column_id === projeto.column_id);
    if (coluna) nomeColuna = coluna.name;
  } catch (e) {
    console.warn("⚠️ Não foi possível obter o nome da coluna:", e.message);
  }

  const subtarefasConcluidas = projeto.finished_subtask_count || 0;
  const subtarefasPendentes = projeto.unfinished_subtask_count || 0;
  const resumo5w2hBruto = projeto.custom_fields?.[0]?.value || "";
  const resumo5w2h = limparTextoMultilinha(removerHtmlTags(resumo5w2hBruto));

  return `📊 *Status do Projeto: ${removerHtmlTags(projeto.title)}*

📌 *Objetivo:* ${removerHtmlTags(projeto.description)}

📍 *Status atual:* ${nomeColuna}
📋 *Período previsto:* ${projeto.initiative_details?.planned_start_date || "-"} até ${projeto.initiative_details?.planned_end_date || "-"}

📋 *Subtarefas:*
✅ ${subtarefasConcluidas} finalizadas
⏳ ${subtarefasPendentes} pendentes

🧐 *Resumo Estratégico (5W2H)*
${resumo5w2h
    .replace(/# O que\?/gi, '\n🔹 *O que?*')
    .replace(/# Por que\?/gi, '\n🔹 *Por que?*')
    .replace(/# Onde\?/gi, '\n🔹 *Onde?*')
    .replace(/# Quando\?/gi, '\n🔹 *Quando?*')
    .replace(/# Quem\?/gi, '\n🔹 *Quem?*')
    .replace(/# Como\?/gi, '\n🔹 *Como?*')
    .replace(/# Quanto\?/gi, '\n🔹 *Quanto?*')}`;
}

async function enviarMensagem(numero, mensagem) {
  try {
    await axios.post(
      `${process.env.WHATSAPP_API_URL}/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: { body: mensagem }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error.response?.data || error.message);
  }
}

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message && message.text && message.from) {
      const texto = message.text.body.trim().toLowerCase();
      const numero = message.from;

      try {
        const resposta = await buscarStatusProjeto(texto, numero);
        await enviarMensagem(numero, resposta);
      } catch (e) {
        console.error(`❌ Erro ao processar mensagem de ${numero}:`, e.stack || e.message);
        await enviarMensagem(numero, "❌ Ocorreu um erro inesperado. Tente novamente mais tarde.");
      }
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "meu_token_webhook";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
