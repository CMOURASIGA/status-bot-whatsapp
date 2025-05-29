# 🤖 Status_Report_bot - WhatsApp + Kanbanize + n8n

Este repositório contém um fluxo de automação criado no [n8n](https://n8n.io/) para realizar consultas de status de projetos via WhatsApp, utilizando a API do Kanbanize (Businessmap) e lógica de conversação com persistência de contexto.

---

## 📌 Objetivo

Permitir que qualquer pessoa envie uma mensagem via WhatsApp e receba o status de um projeto específico, formatado com base em informações como título, descrição, status atual, subtarefas e resumo estratégico 5W2H.

---

## 🔗 Integrações Utilizadas

- ✅ **WhatsApp Business Cloud API** (Meta)
- ✅ **Kanbanize API v2** (Businessmap)
- ✅ **n8n** (open source automation platform)
- ✅ **Google Apps Script (opcional)** – para gerar slides/imagens

---

## ⚙️ Estrutura do Fluxo (Resumo 5W2H por Nó)

| Etapa | What | Why | Where | When | Who | How | How much |
|-------|------|-----|-------|------|-----|-----|-----------|
| **1. WhatsApp Trigger** | Inicia o fluxo ao receber mensagem | Detectar e ativar atendimento | Webhook via Meta | Ao receber mensagem | Usuário final | Webhook REST | Custo da API Meta |
| **2. Gerenciar Etapa da Conversa** | Define contexto da conversa | Controlar o fluxo interativo | JS node | Após cada mensagem | Bot | Lógica JavaScript | Nenhum |
| **3. Switch - Etapas** | Direciona o próximo nó | Segmentar ações por etapa | Interno | Após análise de etapa | Bot | Switch n8n | Nenhum |
| **4. Listar Projetos** | Busca projetos no Kanbanize | Mostrar opções ao usuário | API Kanbanize | Quando a etapa é 'aguardando_projeto_id' | Bot/API | HTTP Request | Consumo de API |
| **5. Formatar Lista de Projetos** | Monta mensagem com lista | Facilitar escolha de ID | Interno | Após retorno da API | Bot | Função n8n | Nenhum |
| **6. Buscar Detalhes do Projeto** | Traz dados do projeto escolhido | Gerar status detalhado | API Kanbanize | Com ID válido | Bot | HTTP Request | Consumo de API |
| **7. Gerar Status do Projeto** | Cria resposta com base nos dados | Apresentar status ao usuário | Interno ou via Google Script | Após busca dos dados | Bot | Função/POST | Opcional (imagem) |
| **8. Enviar Resposta no WhatsApp** | Entrega mensagem ao usuário | Finalizar a consulta | WhatsApp | Após montar resposta | Bot/API | HTTP POST | Meta API |

---

## 🧠 Comportamentos Adicionais

- 💬 Suporta entrada de texto como saudação ("oi", "olá", etc.)
- 🔢 Se o usuário envia apenas um número, entende como ID do projeto
- 🚪 Se digitar "sair", a conversa é encerrada com uma mensagem gentil
- ⚠️ Se digitar algo inválido, o bot orienta como recomeçar

---

## 💡 Exemplos de Comando

| Mensagem do Usuário | Ação do Bot |
|---------------------|-------------|
| `Oi`                | Exibe lista de projetos |
| `1325`              | Busca o projeto com ID 1325 |
| `sair`              | Encerra a conversa com despedida |
| `asdf`              | Retorna erro amigável com orientação |

---

## 📦 Requisitos

- Conta no [n8n Cloud](https://n8n.io/) ou instância self-hosted
- Token da API da **Meta WhatsApp Business Cloud**
- Token da API da **Kanbanize (Businessmap)**
- (Opcional) Endpoint de Google Apps Script para gerar imagem de status

---

## 🚀 Próximas Evoluções

- [ ] Geração automática de slides no Google Slides
- [ ] Integração com Notion ou Google Sheets para logging
- [ ] Histórico de consultas por número de WhatsApp

---

## 📁 Arquivos do Repositório

- `Status_Report_bot.json` – Arquivo de fluxo para importação no n8n
- `README.md` – Este documento com descrição técnica e funcional

---

## 🧑‍💻 Autor

Desenvolvido por **Christian** com apoio de IA (ChatGPT + n8n).

---

## 📬 Contato

Caso tenha interesse em adaptar esse fluxo para sua empresa ou projeto, entre em contato com o autor!

---
