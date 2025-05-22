const express = require("express");
const { buscarStatusProjeto } = require("./googleSheets");
const cron = require("node-cron");

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

// Exemplo de CRON job para enviar relatório automático (simulação)
cron.schedule("0 9 * * 1", () => {
  console.log("[CRON] Segunda-feira 9h - Enviar relatórios automáticos");
  // Aqui você pode chamar a função de envio para todos os projetos
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

app.get("/enviar", async (req, res) => {
  const numero = req.query.numero || process.env.DESTINO_TESTE;
  const mensagem = req.query.msg || "✅ Bot do Project_Manager_Bot ativo!";

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
    res.send("Mensagem enviada com sucesso!");
  } catch (error) {
    res.send(`Erro ao enviar mensagem: ${error.message}`);
  }
});

