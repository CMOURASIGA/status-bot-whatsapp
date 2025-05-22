const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { google } = require("googleapis");

async function autorizarGoogle() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  //const credentials = JSON.parse(fs.readFileSync(path.resolve(process.env.GOOGLE_CREDENTIALS_PATH)));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return await auth.getClient();
}


async function buscarStatusProjeto(nomeProjeto) {
  const authClient = await autorizarGoogle();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "Projetos_Status!A2:G",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Planilha vazia ou não encontrada.");
  }

  const projeto = rows.find(row => row[0]?.toLowerCase() === nomeProjeto.toLowerCase());

  if (!projeto) {
    throw new Error("Projeto não encontrado.");
  }

  const [nome, ultimaAtualizacao, responsavel, status, proximosPassos, riscos, link] = projeto;

  return (
    `📊 *Status Report - Projeto ${nome}*\n\n` +
    `📅 Última atualização: ${ultimaAtualizacao}\n` +
    `👤 Responsável: ${responsavel}\n\n` +
    `📌 Status Atual:\n${status}\n\n` +
    `🔜 Próximos Passos:\n${proximosPassos}\n\n` +
    `⚠️ Riscos:\n${riscos || "Nenhum."}\n\n` +
    (link ? `📎 Relatório: ${link}` : "")
  );
}

module.exports = {
  buscarStatusProjeto
};
