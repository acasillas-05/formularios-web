-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "UsuarioFormPermiso" (
    "usuario_id" TEXT NOT NULL,
    "form_slug" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    PRIMARY KEY ("usuario_id", "form_slug"),
    CONSTRAINT "UsuarioFormPermiso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "usuario_email" TEXT NOT NULL,
    "form_slug" TEXT NOT NULL,
    "sp_name" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionLog_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submission_id" TEXT,
    "kind" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_activo_idx" ON "Usuario"("activo");

-- CreateIndex
CREATE INDEX "UsuarioFormPermiso_form_slug_idx" ON "UsuarioFormPermiso"("form_slug");

-- CreateIndex
CREATE INDEX "SubmissionLog_form_slug_created_at_idx" ON "SubmissionLog"("form_slug", "created_at");

-- CreateIndex
CREATE INDEX "SubmissionLog_usuario_id_created_at_idx" ON "SubmissionLog"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "SubmissionLog_result_created_at_idx" ON "SubmissionLog"("result", "created_at");

-- CreateIndex
CREATE INDEX "NotificationQueue_sent_at_idx" ON "NotificationQueue"("sent_at");
