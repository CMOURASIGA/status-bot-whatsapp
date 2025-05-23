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

const saudacoes = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "e aí", "salve", "tudo bem"];

async function buscarStatusProjeto(projetoNome) {
  try {
    if (saudacoes.includes(projetoNome.toLowerCase())) {
      return "🤖 Tudo bem! Qual projeto deseja o histórico?\nEnvie o nome completo ou parte do nome que eu procuro pra você.";
    }

    const headers = {
      apikey: process.env.BUSINESSMAP_API_KEY,
      accept: "application/json"
    };

    let projeto = null;
    let boardId = null;
    let columnId = null;
    let projetosEncontrados = [];

    if (!isNaN(projetoNome)) {
      const urlDireta = `https://cnc.kanbanize.com/api/v2/cards/${projetoNome}`;
      const resposta = await axios.get(urlDireta, { headers });
      projeto = resposta.data.data;
      boardId = projeto.board_id;
      columnId = projeto.column_id;
    } else {
      const boardsUrl = `https://cnc.kanbanize.com/api/v2/boards`;
      const boardsResponse = await axios.get(boardsUrl, { headers });
      const boards = boardsResponse.data;

      if (!Array.isArray(boards)) {
        throw new Error("Formato inesperado de resposta da API (boards)");
      }

      for (const board of boards) {
        const cardsUrl = `https://cnc.kanbanize.com/api/v2/boards/${board.board_id}/cards`;
        const cardsResponse = await axios.get(cardsUrl, { headers });
        const cards = cardsResponse.data;

        if (Array.isArray(cards)) {
          const encontrados = cards.filter(card =>
            normalizarTexto(card.title).includes(normalizarTexto(projetoNome))
          );
          projetosEncontrados.push(...encontrados.map(card => ({ ...card, board_id: board.board_id })));
        }
      }

      if (projetosEncontrados.length === 1) {
        projeto = projetosEncontrados[0];
        boardId = projeto.board_id;
        columnId = projeto.column_id;
      } else if (projetosEncontrados.length > 1) {
        const lista = projetosEncontrados.map(p => `🔹 ${p.title} (ID ${p.card_id})`).join("\n");
        return `🔍 Foram encontrados múltiplos projetos com esse nome. Qual deseja consultar?\n\n${lista}\n\n*Digite o número do ID do projeto desejado.*`;
      }
    }

    if (!projeto) {
      return "❌ Projeto não encontrado na base de dados do Businessmap.";
    }

    let nomeColuna = projeto.column_id || "-";
    if (boardId && columnId) {
      try {
        const colunasUrl = `https://cnc.kanbanize.com/api/v2/boards/${boardId}/columns`;
        const colunasResponse = await axios.get(colunasUrl, { headers });
        const colunas = colunasResponse.data;

        const coluna = colunas.find(c => c.column_id === columnId);
        if (coluna) nomeColuna = coluna.name;
      } catch (e) {
        console.warn("Não foi possível obter o nome da coluna:", e.message);
      }
    }

    const subtarefasConcluidas = projeto.finished_subtask_count || 0;
    const subtarefasPendentes = projeto.unfinished_subtask_count || 0;
    const resumo5w2hBruto = projeto.custom_fields?.[0]?.value || "";
    const resumo5w2h = limparTextoMultilinha(removerHtmlTags(resumo5w2hBruto));

    const resposta = `📊 *Status do Projeto: ${removerHtmlTags(projeto.title)}*

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

    return resposta;
  } catch (error) {
    console.error("Erro ao buscar status do projeto:", error.response?.data || error.message);
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
