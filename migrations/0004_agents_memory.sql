-- Leonardo + Jade: agentes, memória de pesquisa por agente e conversas entre agentes.
-- Aditiva: não altera nem apaga tabelas existentes. Aplicar no MESMO banco D1 do Leonardo (binding DB),
-- depois de 0001 e 0002. O número 0003 está reservado para o PR de Conversations.
-- Nenhuma rota do código executa DELETE nestas tabelas: versões novas são sempre acrescentadas.

CREATE TABLE IF NOT EXISTS agents (
 owner TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
 instructions TEXT NOT NULL, origin TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);

-- Cada versão anterior das instruções é preservada antes de qualquer alteração.
CREATE TABLE IF NOT EXISTS agent_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, agent_id TEXT NOT NULL,
 payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_versions_agent ON agent_versions(owner,agent_id,id);

-- Memória de pesquisa: versões imutáveis agrupadas por root_id; a versão vigente é a de maior seq.
CREATE TABLE IF NOT EXISTS agent_memories (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 owner TEXT NOT NULL, id TEXT NOT NULL, root_id TEXT NOT NULL, parent_id TEXT,
 agent_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('compartilhada','privada')),
 kind TEXT NOT NULL CHECK(kind IN ('pesquisa','fato','ideia','aprendizado','hipotese','referencia')),
 status TEXT NOT NULL CHECK(status IN ('rascunho','verificada','contestada','substituida')),
 origin TEXT NOT NULL CHECK(origin IN ('humano','agente')),
 title TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL DEFAULT '',
 conversation_id TEXT, reviewed_at TEXT,
 digest TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(owner,id)
);
CREATE INDEX IF NOT EXISTS agent_memories_root ON agent_memories(owner,root_id,seq);

CREATE TABLE IF NOT EXISTS agent_conversations (
 owner TEXT NOT NULL, id TEXT NOT NULL, topic TEXT NOT NULL, platform TEXT NOT NULL, lang TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('em_andamento','concluida','incompleta')),
 post_root_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS agent_conversations_recent ON agent_conversations(owner,created_at);

CREATE TABLE IF NOT EXISTS agent_messages (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, conversation_id TEXT NOT NULL,
 step TEXT NOT NULL, agent_id TEXT NOT NULL, text TEXT NOT NULL, payload TEXT NOT NULL,
 model TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_messages_conversation ON agent_messages(owner,conversation_id,seq);
