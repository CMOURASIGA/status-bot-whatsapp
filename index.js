const express = require("express");
const axios = require("axios");
require("dotenv/config");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Estado das conversas por número
const estados = {};

// Função para enviar mensagem via WhatsApp
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

// Webhook que recebe mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    const entry = body.entry?.[0];
    const message = entry?.changes?.[0]?.value?.messages?.[0];

    if (message && message.text && message.from) {
      const numero = message.from;
      const texto = message.text.body.trim();

      try {
        // Envia o contexto atual para o n8n
        const resposta = await axios.post(
          "https://cnc.app.n8n.cloud/webhook/status-projeto",
          {
            numero,
            texto,
            etapa: estados[numero]?.etapa || null,
            board_id: estados[numero]?.board_id || null
          }
        );

        // Atualiza o estado local com base na resposta do n8n
        if (resposta.data?.etapa) {
          estados[numero] = {
            ...estados[numero],
            etapa: resposta.data.etapa,
            board_id: resposta.data.board_id || estados[numero]?.board_id
          };
        }

        const mensagemRetorno = resposta.data?.mensagem || "✅ Processamento iniciado.";
        await enviarMensagem(numero, mensagemRetorno);
      } catch (error) {
        console.error("Erro ao chamar n8n:", error.message);
        await enviarMensagem(numero, "❌ Erro ao iniciar processo. Tente novamente.");
      }
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Endpoint GET para verificação do Webhook
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
  console.log(`✅ Servidor WhatsApp ativo na porta ${PORT}`);
});
