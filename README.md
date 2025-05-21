# 🤖 Bot Status Report de Projetos

Este bot consulta uma planilha do Google Sheets e retorna via endpoint (e futuramente WhatsApp) o status de um projeto específico.

## ✅ Funcionalidades
- Consulta o status de um projeto por nome
- Retorna última atualização, responsável, próximos passos e riscos
- Integra com Google Sheets usando uma conta de serviço
- Disparos automáticos podem ser feitos com CRON

## 🔧 Requisitos
- Conta no Google Cloud com planilha criada
- Variáveis de ambiente:
  - `PORT`: Porta de execução local/render
  - `SHEET_ID`: ID da planilha
  - `GOOGLE_CREDENTIALS`: Credencial da conta de serviço em formato JSON

## ▶️ Uso

```
GET /status?projeto=nome-do-projeto
```

Retorno:
```
📊 *Status Report - Projeto Nome*
📅 Última atualização: XX/XX/XXXX
👤 Responsável: Fulano
📌 Status Atual: ...
🔜 Próximos Passos: ...
⚠️ Riscos: ...
📎 Relatório: link (se houver)
```

## 📁 Estrutura
```
├── index.js
├── googleSheets.js
├── .env.example
├── package.json
└── README.md
```

## ✨ Futuro
- Integração com WhatsApp Cloud API
- Geração de resumo automático com OpenAI
- Painel de acompanhamento
- Suporte a múltiplos projetos por cliente
