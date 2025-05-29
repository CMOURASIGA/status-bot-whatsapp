📥 Prompt IA:
Você é um especialista em automação com n8n. Quero que gere um fluxo JSON para o n8n com os seguintes requisitos:

Gatilho: WhatsApp webhook (mensagem recebida).

Primeiro nó: interpreta o texto e define a etapa da conversa (inicial, aguardando_projeto_id, validando_projeto_id, encerrado).

Se a etapa for saudação (oi, olá), retorna uma mensagem solicitando o ID do projeto.

Se for um número, considera que é o ID do projeto e busca detalhes via API da Kanbanize (autenticação por token).

A seguir, monta um status do projeto com:

Título

Descrição

Status atual (coluna)

Datas de início e fim

Contagem de subtarefas

Campos do resumo 5W2H formatados (O que, Por que, Onde, Quando, Quem, Como, Quanto)

O conteúdo final é enviado via WhatsApp novamente (via API da Meta).

Se o usuário digitar "sair", encerre a conversa e oriente a reiniciar com "oi".

Gere o JSON completo para importação no n8n.
