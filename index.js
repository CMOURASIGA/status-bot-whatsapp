const express = require("express");
const { buscarStatusProjeto } = require("./googleSheets");
const cron = require("node-cron");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint de teste manual via browser ou ferramenta externa
app.get("/status", async (req, res) => {
  const projeto = req.query.projeto;

  if (!projeto) {
    return res.status(400).send("Projeto não informado. Use ?projeto=nome-do-projeto");
  }

  try {
    const status = await buscarStatusProjeto(projeto);
    return res.send(status);
  } catch (error) {
    return res.status(500).send("Erro ao buscar status do projeto: " + error.message);
  }
});

// Webhook do WhatsApp
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message && message.text && message.from) {
      const texto = message.text.body.toLowerCase();
      const numero = message.from;

      if (texto.includes("menu")) {
        await enviarMensagem(
          numero,
          "📋 *Menu de Comandos:*\n1. status app-financeiro\n2. mensagem do dia\n3. ajuda"
        );
      } else if (texto.includes("mensagem")) {
        await enviarMensagem(numero, "🌟 Acredite: todo dia é uma nova oportunidade de evoluir!");
      } else if (texto.includes("ajuda")) {
        await enviarMensagem(numero, "ℹ️ Digite 'menu' para ver todas as opções disponíveis.");
      } else {
        try {
          const status = await buscarStatusProjeto(texto);
          await enviarMensagem(numero, status);
        } catch (e) {
          await enviarMensagem(
            numero,
            "❓ Não entendi sua mensagem ou o projeto não foi encontrado. Digite *menu* para ver os comandos disponíveis."
          );
        }
      }
    }

    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

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
    console.error("Erro ao enviar mensagem:", error.response?.data || error.message);
  }
}

// Exemplo de CRON job para enviar relatório automático (simulação)
cron.schedule("0 9 * * 1", () => {
  console.log("[CRON] Segunda-feira 9h - Enviar relatórios automáticos");
  // Aqui você pode chamar a função de envio para todos os projetos
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Endpoint manual para testes rápidos via browser
app.get("/enviar", async (req, res) => {
  const numero = req.query.numero || process.env.DESTINO_TESTE;
  const mensagem = req.query.msg || "✅ Bot do Project_Manager_Bot ativo!";

  try {
    await enviarMensagem(numero, mensagem);
    res.send("Mensagem enviada com sucesso!");
  } catch (error) {
    res.send(`Erro ao enviar mensagem: ${error.message}`);
  }
});

// Endpoint GET para verificação do Webhook com a Meta
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
