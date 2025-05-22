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

async function buscarStatusProjeto(projetoNome) {
  try {
    const headers = {
      apikey: process.env.BUSINESSMAP_API_KEY,
      accept: "application/json"
    };

    const boardsUrl = `https://cnc.kanbanize.com/api/v2/boards`;
    const boardsResponse = await axios.get(boardsUrl, { headers });
    const boards = boardsResponse.data;

    if (!Array.isArray(boards)) {
      throw new Error("Formato inesperado de resposta da API (boards)");
    }

    let allCards = [];

    for (const board of boards) {
      const cardsUrl = `https://cnc.kanbanize.com/api/v2/boards/${board.board_id}/cards`;
      const cardsResponse = await axios.get(cardsUrl, { headers });
      if (Array.isArray(cardsResponse.data)) {
        allCards = allCards.concat(cardsResponse.data);
      }
    }

    const projeto = allCards.find(card =>
      card.card_id.toString() === projetoNome ||
      card.title.toLowerCase().includes(projetoNome.toLowerCase())
    );

    if (!projeto) {
      return "❌ Projeto não encontrado na base de dados do Businessmap.";
    }

    const subtarefasConcluidas = projeto.finished_subtask_count || 0;
    const subtarefasPendentes = projeto.unfinished_subtask_count || 0;
    const resumo5w2h = projeto.custom_fields?.[0]?.value || "(Resumo 5W2H não preenchido)";

    const resposta = `📊 *Status do Projeto: ${removerHtmlTags(projeto.title)}*

📌 *Objetivo:* ${removerHtmlTags(projeto.description)}

📍 *Status atual:* Coluna ${projeto.column_id || "-"}
🗓️ *Período previsto:* ${projeto.initiative_details?.planned_start_date || "-"} até ${projeto.initiative_details?.planned_end_date || "-"}

📋 *Subtarefas:*\n✅ ${subtarefasConcluidas} finalizadas\n⏳ ${subtarefasPendentes} pendentes

🧠 *Resumo Estratégico (5W2H)*

${removerHtmlTags(resumo5w2h)}`;

    return resposta;
  } catch (error) {
    console.error("Erro ao buscar status do projeto:", error);
    return "❌ Ocorreu um erro ao consultar o status do projeto.";
  }
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
    console.error("Erro ao enviar mensagem:", error.response?.data || error.message);
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
        const status = await buscarStatusProjeto(texto);
        await enviarMensagem(numero, status);
      } catch (e) {
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
    console.log("Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
