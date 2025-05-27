const express = require("express");
const axios = require("axios");
require("dotenv/config");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
    const message = entry?.changes?.[0]?.value?.messages?.[0];

    if (message && message.text && message.from) {
      try {
        const resposta = await axios.post(
          "https://cnc.app.n8n.cloud/webhook/status-projeto",
          {
            numero: message.from,
            texto: message.text.body.trim()
          }
        );
        const mensagemRetorno = resposta.data?.mensagem || "✅ Processamento iniciado.";
        await enviarMensagem(message.from, mensagemRetorno);
      } catch (error) {
        console.error("Erro ao chamar n8n:", error.message);
        await enviarMensagem(message.from, "❌ Erro ao iniciar processo. Tente novamente.");
      }
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor WhatsApp ativo na porta ${PORT}`);
});
