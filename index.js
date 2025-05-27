const estados = {}; // Armazena o histórico da conversa por número

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object) {
    const entry = body.entry?.[0];
    const message = entry?.changes?.[0]?.value?.messages?.[0];

    if (message && message.text && message.from) {
      const numero = message.from;
      const texto = message.text.body.trim();

      try {
        // envia também o estado atual para o n8n
        const resposta = await axios.post(
          "https://cnc.app.n8n.cloud/webhook/status-projeto",
          {
            numero,
            texto,
            etapa: estados[numero]?.etapa || null,
            board_id: estados[numero]?.board_id || null
          }
        );

        // atualiza o estado local com os dados que o n8n devolveu
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
