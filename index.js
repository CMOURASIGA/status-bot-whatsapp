const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
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

async function buscarBoards(headers) {
  console.log("🔍 Buscando boards...");
  const response = await axios.get("https://cnc.kanbanize.com/api/v2/boards", { headers });
  console.log("📦 Dados recebidos dos boards:", response.data);
  const boards = Array.isArray(response.data) ? response.data : response.data?.data || [];

  if (!Array.isArray(boards)) {
    console.error("❌ ERRO: boards não é um array válido!", boards);
    throw new Error("Formato inesperado de resposta ao buscar boards");
  }

  return boards;
}

async function buscarCards(headers) {
  console.log("🔍 Buscando cards...");
  const response = await axios.get("https://cnc.kanbanize.com/api/v2/cards", { headers });
  console.log("📦 Dados recebidos dos cards:", response.data);
  const cards = Array.isArray(response.data) ? response.data : response.data?.data || [];

  if (!Array.isArray(cards)) {
    console.error("❌ ERRO: cards não é um array válido!", cards);
    throw new Error("Formato inesperado de resposta ao buscar cards");
  }

  return cards;
}

async function buscarStatusProjeto(projetoNome, numero) {
  const headers = {
    apikey: process.env.BUSINESSMAP_API_KEY,
    accept: "application/json"
  };

  console.log(`[${numero}] Etapa atual:`, estados[numero]?.etapa || "início");
  console.log(`[${numero}] Texto recebido:`, projetoNome);

  if (!estados[numero]) {
    if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(projetoNome)) {
      estados[numero] = { etapa: "aguardando_board" };
      const boards = await buscarBoards(headers);
      const listaBoards = boards.map(b => `🔹 ${b.name} (ID ${b.board_id})`).join("\n");
      return `🤖 Tudo bem! Qual equipe deseja consultar?\n${listaBoards}\n\n*Responda com o número do ID da equipe.*`;
    }
    return "❌ Envie uma saudação para começar (ex: 'Oi').";
  }

  const estadoAtual = estados[numero];

  if (estadoAtual.etapa === "aguardando_board") {
    const boardId = parseInt(projetoNome);
    if (isNaN(boardId)) return "❌ Por favor, envie apenas o número do ID da equipe.";
    estadoAtual.board_id = boardId;
    estadoAtual.etapa = "aguardando_projeto";
    return `Equipe registrada! Agora, me diga o nome do projeto que deseja consultar.`;
  }

  if (estadoAtual.etapa === "aguardando_projeto") {
    const cards = await buscarCards(headers);
    const cardsFiltrados = cards.filter(card =>
      card.board_id === estadoAtual.board_id &&
      normalizarTexto(card.title).includes(normalizarTexto(projetoNome))
    );

    if (cardsFiltrados.length === 0) {
      return "❌ Nenhum projeto encontrado com esse nome para essa equipe.";
    } else if (cardsFiltrados.length === 1) {
      estadoAtual.etapa = "completo";
      return montarStatusProjeto(cardsFiltrados[0], headers);
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
    const colunas = colunasResponse.data;
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
🗓️ *Período previsto:* ${projeto.initiative_details?.planned_start_date || "-"} até ${projeto.initiative_details?.planned_end_date || "-"}

📋 *Subtarefas:*
✅ ${subtarefasConcluidas} finalizadas
⏳ ${subtarefasPendentes} pendentes

🧠 *Resumo Estratégico (5W2H)*
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
    console.log(`📤 Enviando mensagem para ${numero}...`);
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
    console.log("✅ Mensagem enviada com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error.response?.data || error.message);
  }
}

app.post("/webhook", async (req, res) => {
  const body = req.body;
  console.log("[📩 Webhook Recebido]", JSON.stringify(body, null, 2));

  if (body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message && message.text && message.from) {
      const texto = message.text.body.trim().toLowerCase();
      const numero = message.from;
      console.log(`📨 Mensagem recebida de ${numero}: ${texto}`);

      try {
        const resposta = await buscarStatusProjeto(texto, numero);
        console.log(`🤖 Resposta gerada: ${resposta}`);
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
    console.log("✅ Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
