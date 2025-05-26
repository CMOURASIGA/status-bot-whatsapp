const express = require("express");
const axios = require("axios");
require("dotenv/config");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function removerHtmlTags(texto) {
  return texto?.replace(/<[^>]*>?/gm, "").trim() || "(Não informado)";
}

function limparTextoMultilinha(texto) {
  return texto?.replace(/\n+/g, "\n").trim() || "(Não informado)";
}

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function padronizar5w2h(texto) {
  return texto
    .replace(/#\s*O que\?/gi, "\n\n🔹 *O que?*")
    .replace(/#\s*Por que\?/gi, "\n\n🔹 *Por que?*")
    .replace(/#\s*Onde\?/gi, "\n\n🔹 *Onde?*")
    .replace(/#\s*Quando\?/gi, "\n\n🔹 *Quando?*")
    .replace(/#\s*Quem\?/gi, "\n\n🔹 *Quem?*")
    .replace(/#\s*Como\?/gi, "\n\n🔹 *Como?*")
    .replace(/#\s*Quanto\?/gi, "\n\n🔹 *Quanto?*");
}

async function enviarMensagem(numero, mensagem) {
  try {
    await axios.post(
      `${process.env.WHATSAPP_API_URL}/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: { body: mensagem },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error.response?.data || error.message);
  }
}

const estados = {};

async function buscarStatusProjeto(projeto, numero) {
  const headers = {
    apikey: process.env.BUSINESSMAP_API_KEY,
    accept: "application/json",
  };

  try {
    const response = await axios.get(`https://cnc.kanbanize.com/api/v2/cards/${projeto}`, { headers });
    const dados = response.data?.data || response.data;

    const nomeColuna = dados.column_name || "-";
    const resumo5w2hBruto = dados.custom_fields?.[0]?.value || "";
    const resumo5w2h = padronizar5w2h(limparTextoMultilinha(removerHtmlTags(resumo5w2hBruto)));

    const payload = {
      titulo_projeto: removerHtmlTags(dados.title),
      status_atual: nomeColuna,
      periodo_previsto: `${dados.initiative_details?.planned_start_date || "-"} até ${dados.initiative_details?.planned_end_date || "-"}`,
      objetivo: removerHtmlTags(dados.description),
      subtarefas_concluidas: `${dados.finished_subtask_count || 0}`,
      subtarefas_pendentes: `${dados.unfinished_subtask_count || 0}`,
      o_que: resumo5w2h.match(/(?<=\*O que\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      por_que: resumo5w2h.match(/(?<=\*Por que\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      onde: resumo5w2h.match(/(?<=\*Onde\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      quando: resumo5w2h.match(/(?<=\*Quando\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      quem: resumo5w2h.match(/(?<=\*Quem\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      como: resumo5w2h.match(/(?<=\*Como\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
      quanto: resumo5w2h.match(/(?<=\*Quanto\?\*\n)(.*?)(?=\n🔹|\n*$)/s)?.[0] || "-",
    };

    const imagem = await axios.post("https://script.google.com/macros/s/AKfycby8ClXKX1QAq8Mv7V8lX1Cxpavvq5VkICXBIFa1IpgR5xQ5R92N_6Sj9puOp12e4X0Y/exec", payload, {
      headers: { "Content-Type": "application/json" }
    });

    const imagem_url = imagem.data?.imagem_url;

    return imagem_url
      ? `🖼️ Status visual do projeto *${payload.titulo_projeto}*:\n${imagem_url}`
      : `❌ Não foi possível gerar a imagem. Segue o status textual:\n${resumo5w2h}`;

  } catch (error) {
    console.error("❌ Erro ao buscar status:", error.message);
    return "❌ Ocorreu um erro ao buscar o status do projeto.";
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

      const resposta = await buscarStatusProjeto(texto, numero);
      await enviarMensagem(numero, resposta);
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
