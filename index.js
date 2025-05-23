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
    if (isNaN(id)) return "❌ O ID informado não é válido.";

    try {
      const response = await axios.get(`https://cnc.kanbanize.com/api/v2/cards/${id}`, {
        headers: {
          apikey: process.env.BUSINESSMAP_API_KEY,
          accept: "application/json"
        }
      });

      const projeto = response.data;
      estadoAtual.etapa = "completo";
      return montarStatusProjeto(projeto, headers);
    } catch (e) {
      console.error("❌ Erro ao buscar card por ID:", e.message);
      return "❌ Não foi possível localizar o projeto pelo ID informado.";
    }
  }

  return "❌ Conversa finalizada. Envie 'oi' para começar novamente.";
}

// ... resto do código permanece inalterado ...
