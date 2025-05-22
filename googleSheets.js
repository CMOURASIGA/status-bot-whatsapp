const { google } = require("googleapis");
const { JWT } = require("google-auth-library");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Projetos_Status"; // Nome da aba da planilha

const auth = new JWT({
  email: JSON.parse(process.env.GOOGLE_CREDENTIALS).client_email,
  key: JSON.parse(process.env.GOOGLE_CREDENTIALS).private_key,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });

async function buscarStatusProjeto(nomeProjeto) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:G`,
    });

    const linhas = response.data.values;
    const linhaProjeto = linhas.find((linha) =>
      linha[0]?.toLowerCase().includes(nomeProjeto.toLowerCase())
    );

    if (!linhaProjeto) return "Projeto não encontrado na planilha.";

    const [projeto, dataAtualizacao, responsavel, status, proximoPasso, risco, link] = linhaProjeto;

    return (
      `📊 *Status Report - Projeto ${projeto}*

` +
      `📅 Última atualização: ${dataAtualizacao}
` +
      `👤 Responsável: ${responsavel}

` +
      `📌 *Status Atual:*
${status}

` +
      `🗂 *Próximos Passos:*
${proximoPasso}

` +
      `⚠️ *Riscos:*
${risco}

` +
      `📎 Relatório: ${link}`
    );
  } catch (error) {
    console.error("Erro ao acessar planilha:", error.message);
    return "Erro ao acessar os dados do projeto.";
  }
}

module.exports = { buscarStatusProjeto };

