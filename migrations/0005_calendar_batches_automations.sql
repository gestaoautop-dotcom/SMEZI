-- Calendário com mídia, postagem em lote, automações por palavra-gatilho e registro de uso de IA.
-- Aditiva: não altera nem apaga tabelas existentes. Aplicar no MESMO banco D1 do Leonardo (binding DB),
-- depois de 0001, 0002, 0003 e 0004.

-- Fotos dos posts. O arquivo fica no R2 (binding MEDIA); aqui ficam os metadados.
-- public_token gera uma URL pública impossível de adivinhar, exigida pelas redes para buscar a imagem.
CREATE TABLE IF NOT EXISTS media_assets (
 owner TEXT NOT NULL, id TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL,
 bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, public_token TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_token ON media_assets(public_token);

-- Lote: uma peça publicada em várias redes no mesmo horário. Cada rede tem seu próprio post versionado.
CREATE TABLE IF NOT EXISTS post_batches (
 owner TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, planned_at TEXT NOT NULL,
 media_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS post_batches_planned ON post_batches(owner,planned_at);
CREATE TABLE IF NOT EXISTS post_batch_items (
 owner TEXT NOT NULL, batch_id TEXT NOT NULL, platform TEXT NOT NULL, root_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(owner,batch_id,platform)
);
CREATE INDEX IF NOT EXISTS post_batch_items_root ON post_batch_items(owner,root_id);

-- Regras de automação. Cada alteração grava a versão anterior em automation_rule_versions.
CREATE TABLE IF NOT EXISTS automation_rules (
 owner TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('instagram','facebook')),
 source TEXT NOT NULL CHECK(source IN ('comentario','dm')),
 keywords TEXT NOT NULL, match_mode TEXT NOT NULL CHECK(match_mode IN ('contem','exata')),
 public_reply TEXT NOT NULL DEFAULT '', private_reply TEXT NOT NULL DEFAULT '',
 mode TEXT NOT NULL CHECK(mode IN ('rascunho','aprovacao','automatico')),
 active INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 100,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE TABLE IF NOT EXISTS automation_rule_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, rule_id TEXT NOT NULL,
 payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS automation_rule_versions_rule ON automation_rule_versions(owner,rule_id,id);

-- Eventos recebidos (comentários e DMs). O id é o da Meta: garante que nada seja respondido duas vezes.
-- text guarda no máximo 1.000 caracteres, necessários para a revisão humana.
CREATE TABLE IF NOT EXISTS automation_events (
 owner TEXT NOT NULL, id TEXT NOT NULL,
 channel TEXT NOT NULL, source TEXT NOT NULL, account_id TEXT NOT NULL,
 sender_id TEXT NOT NULL, sender_name TEXT NOT NULL DEFAULT '', media_id TEXT NOT NULL DEFAULT '',
 text TEXT NOT NULL, received_at TEXT NOT NULL, rule_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('recebido','sem_regra','rascunho','pendente','enviando','enviado','parcial','incerto','falhou','ignorado','bloqueado','permissao_ausente','fora_do_prazo')),
 public_reply TEXT NOT NULL DEFAULT '', private_reply TEXT NOT NULL DEFAULT '',
 public_reply_id TEXT, private_reply_id TEXT, error TEXT, decided_at TEXT, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS automation_events_status ON automation_events(owner,status,received_at);
CREATE INDEX IF NOT EXISTS automation_events_sender ON automation_events(owner,sender_id,rule_id,received_at);

-- Uso de IA para controle de custos. Não guarda prompts nem respostas.
CREATE TABLE IF NOT EXISTS ai_usage (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
 purpose TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, ok INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_recent ON ai_usage(owner,created_at);
