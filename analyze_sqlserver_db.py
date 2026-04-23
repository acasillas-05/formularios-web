#!/usr/bin/env python3
"""
Analiza una base de datos SQL Server y genera un reporte completo de esquema.

Qué genera:
- summary.json: resumen general
- database_info.json: info de la base y servidor
- schemas.csv
- tables.csv
- columns.csv
- primary_keys.csv
- foreign_keys.csv
- unique_constraints.csv
- check_constraints.csv
- defaults.csv
- indexes.csv
- views.csv
- procedures.csv
- functions.csv
- triggers.csv
- table_row_counts.csv
- relationships.csv
- profile_nulls.csv (opcional)
- sample_values.csv (opcional)
- object_definitions/*.sql con definiciones completas

Requisitos:
    pip install pyodbc pandas

Notas:
- Necesitas tener instalado un ODBC Driver para SQL Server (17 o 18 normalmente).
- Llena DB_CONFIG antes de ejecutar.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
import pyodbc

# Carga variables de entorno desde .env si existe (no falla si python-dotenv no está instalado)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

# ==========================
# CONFIGURA TUS CREDENCIALES
# Se leen de variables de entorno. Copia .env.example a .env y llena los valores.
# ==========================
DB_CONFIG = {
    "server": os.getenv("BDADN_SERVER", ""),
    "database": os.getenv("BDADN_DATABASE", ""),
    "username": os.getenv("BDADN_USER", ""),
    "password": os.getenv("BDADN_PASSWORD", ""),
}

# ==========================
# OPCIONES DEL ANALISIS
# ==========================
OUTPUT_DIR = Path("db_analysis_output")
SAVE_OBJECT_DEFINITIONS = True
PROFILE_DATA = False          # True = calcula nulos y muestra muestras de valores
SAMPLE_ROWS_PER_COLUMN = 5    # máximo de valores ejemplo por columna (para tablas pequeñas es muy útil)
MAX_PROFILE_TABLES = None     # None = todas; o un entero, por ejemplo 30
TABLES_INCLUDE = None         # ej. ["dbo.Proveedor", "dbo.Placa", "dbo.PlacaRemolque"]
TABLES_EXCLUDE = {"sysdiagrams"}
CONNECT_TIMEOUT = 10
QUERY_TIMEOUT = 120


@dataclass
class SqlObject:
    schema_name: str
    object_name: str
    object_type: str
    definition: Optional[str]

    @property
    def fq_name(self) -> str:
        return f"{self.schema_name}.{self.object_name}"


def ensure_dependencies() -> None:
    # Imports ya verifican dependencia; esta función existe para mensajes claros.
    pass


def validate_config() -> None:
    missing = [k for k in ("server", "database", "username", "password") if not DB_CONFIG.get(k)]
    if missing:
        raise ValueError(
            "Faltan credenciales en DB_CONFIG: " + ", ".join(missing)
        )


def list_sql_server_drivers() -> list[str]:
    return [d for d in pyodbc.drivers() if "SQL Server" in d]


def build_connection_string() -> str:
    drivers = list_sql_server_drivers()
    preferred = DB_CONFIG.get("driver")

    if preferred:
        driver = preferred
    else:
        if "ODBC Driver 18 for SQL Server" in drivers:
            driver = "ODBC Driver 18 for SQL Server"
        elif "ODBC Driver 17 for SQL Server" in drivers:
            driver = "ODBC Driver 17 for SQL Server"
        elif drivers:
            driver = drivers[-1]
        else:
            raise RuntimeError(
                "No encontré drivers ODBC de SQL Server instalados. "
                "Instala ODBC Driver 17 u 18 para SQL Server."
            )

    server = DB_CONFIG["server"]
    if DB_CONFIG.get("port"):
        server = f"{server},{DB_CONFIG['port']}"

    encrypt = DB_CONFIG.get("encrypt", "yes")
    trust_cert = DB_CONFIG.get("trust_server_certificate", "yes")

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={DB_CONFIG['database']}",
        f"UID={DB_CONFIG['username']}",
        f"PWD={DB_CONFIG['password']}",
        f"Encrypt={encrypt}",
        f"TrustServerCertificate={trust_cert}",
        f"Connection Timeout={CONNECT_TIMEOUT}",
    ]
    return ";".join(parts)


def get_connection() -> pyodbc.Connection:
    conn_str = build_connection_string()
    conn = pyodbc.connect(conn_str)
    conn.timeout = QUERY_TIMEOUT
    return conn


def safe_name(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name.strip())
    return name[:180]


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def df_to_csv(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8-sig")


def fetch_df(conn: pyodbc.Connection, sql: str, params: Optional[Iterable] = None) -> pd.DataFrame:
    return pd.read_sql(sql, conn, params=list(params) if params else None)


def fetch_scalar(conn: pyodbc.Connection, sql: str, params: Optional[Iterable] = None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    row = cur.fetchone()
    return row[0] if row else None


def get_database_info(conn: pyodbc.Connection) -> dict:
    sql = """
    SELECT
        @@SERVERNAME AS server_name,
        DB_NAME() AS database_name,
        SUSER_SNAME() AS login_name,
        CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS product_version,
        CAST(SERVERPROPERTY('ProductLevel') AS NVARCHAR(128)) AS product_level,
        CAST(SERVERPROPERTY('Edition') AS NVARCHAR(256)) AS edition,
        CAST(DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS NVARCHAR(128)) AS collation,
        CAST(DATABASEPROPERTYEX(DB_NAME(), 'Recovery') AS NVARCHAR(128)) AS recovery_model,
        CAST(DATABASEPROPERTYEX(DB_NAME(), 'Status') AS NVARCHAR(128)) AS database_status
    """
    df = fetch_df(conn, sql)
    return df.iloc[0].to_dict() if not df.empty else {}


def get_schemas(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT s.schema_id, s.name AS schema_name
    FROM sys.schemas s
    ORDER BY s.name;
    """
    return fetch_df(conn, sql)


def get_tables(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        s.name AS schema_name,
        t.name AS table_name,
        t.object_id,
        t.create_date,
        t.modify_date,
        t.temporal_type_desc,
        t.is_memory_optimized,
        t.durability_desc
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    ORDER BY s.name, t.name;
    """
    df = fetch_df(conn, sql)
    if TABLES_INCLUDE:
        allowed = set(TABLES_INCLUDE)
        df = df[df.apply(lambda r: f"{r['schema_name']}.{r['table_name']}" in allowed, axis=1)]
    if TABLES_EXCLUDE:
        df = df[~df["table_name"].isin(TABLES_EXCLUDE)]
    return df.reset_index(drop=True)


def get_columns(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        s.name AS schema_name,
        t.name AS table_name,
        c.column_id,
        c.name AS column_name,
        ty.name AS data_type,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        c.is_computed,
        dc.definition AS default_definition,
        cc.definition AS computed_definition,
        CAST(ic.seed_value AS NVARCHAR(128)) AS seed_value,
        CAST(ic.increment_value AS NVARCHAR(128)) AS increment_value,
        CAST(ep.value AS NVARCHAR(MAX)) AS column_description
    FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
    LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    LEFT JOIN sys.extended_properties ep
        ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
    ORDER BY s.name, t.name, c.column_id;
    """
    df = fetch_df(conn, sql)
    if TABLES_INCLUDE:
        allowed = set(TABLES_INCLUDE)
        df = df[df.apply(lambda r: f"{r['schema_name']}.{r['table_name']}" in allowed, axis=1)]
    if TABLES_EXCLUDE:
        df = df[~df["table_name"].isin(TABLES_EXCLUDE)]
    return df.reset_index(drop=True)


def get_primary_keys(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        sch.name AS schema_name,
        tab.name AS table_name,
        kc.name AS pk_name,
        col.name AS column_name,
        ic.key_ordinal
    FROM sys.key_constraints kc
    JOIN sys.tables tab ON tab.object_id = kc.parent_object_id
    JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    WHERE kc.type = 'PK'
    ORDER BY sch.name, tab.name, ic.key_ordinal;
    """
    return fetch_df(conn, sql)


def get_foreign_keys(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        fk.name AS fk_name,
        schp.name AS parent_schema,
        tabp.name AS parent_table,
        colp.name AS parent_column,
        schr.name AS referenced_schema,
        tabr.name AS referenced_table,
        colr.name AS referenced_column,
        fkc.constraint_column_id,
        fk.delete_referential_action_desc,
        fk.update_referential_action_desc,
        fk.is_disabled,
        fk.is_not_trusted
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.tables tabp ON tabp.object_id = fk.parent_object_id
    JOIN sys.schemas schp ON schp.schema_id = tabp.schema_id
    JOIN sys.columns colp ON colp.object_id = tabp.object_id AND colp.column_id = fkc.parent_column_id
    JOIN sys.tables tabr ON tabr.object_id = fk.referenced_object_id
    JOIN sys.schemas schr ON schr.schema_id = tabr.schema_id
    JOIN sys.columns colr ON colr.object_id = tabr.object_id AND colr.column_id = fkc.referenced_column_id
    ORDER BY schp.name, tabp.name, fk.name, fkc.constraint_column_id;
    """
    return fetch_df(conn, sql)


def get_unique_constraints(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        sch.name AS schema_name,
        tab.name AS table_name,
        kc.name AS constraint_name,
        col.name AS column_name,
        ic.key_ordinal
    FROM sys.key_constraints kc
    JOIN sys.tables tab ON tab.object_id = kc.parent_object_id
    JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    WHERE kc.type = 'UQ'
    ORDER BY sch.name, tab.name, kc.name, ic.key_ordinal;
    """
    return fetch_df(conn, sql)


def get_check_constraints(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        sch.name AS schema_name,
        tab.name AS table_name,
        cc.name AS check_name,
        cc.definition,
        cc.is_disabled,
        cc.is_not_trusted
    FROM sys.check_constraints cc
    JOIN sys.tables tab ON tab.object_id = cc.parent_object_id
    JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    ORDER BY sch.name, tab.name, cc.name;
    """
    return fetch_df(conn, sql)


def get_defaults(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        sch.name AS schema_name,
        tab.name AS table_name,
        col.name AS column_name,
        dc.name AS default_name,
        dc.definition
    FROM sys.default_constraints dc
    JOIN sys.tables tab ON tab.object_id = dc.parent_object_id
    JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    JOIN sys.columns col ON col.object_id = tab.object_id AND col.column_id = dc.parent_column_id
    ORDER BY sch.name, tab.name, col.column_id;
    """
    return fetch_df(conn, sql)


def get_indexes(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        sch.name AS schema_name,
        tab.name AS table_name,
        ix.name AS index_name,
        ix.type_desc,
        ix.is_unique,
        ix.is_primary_key,
        ix.is_unique_constraint,
        ix.fill_factor,
        ix.has_filter,
        ix.filter_definition,
        col.name AS column_name,
        ic.key_ordinal,
        ic.is_descending_key,
        ic.is_included_column
    FROM sys.indexes ix
    JOIN sys.tables tab ON tab.object_id = ix.object_id
    JOIN sys.schemas sch ON sch.schema_id = tab.schema_id
    JOIN sys.index_columns ic ON ic.object_id = ix.object_id AND ic.index_id = ix.index_id
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    WHERE ix.name IS NOT NULL
    ORDER BY sch.name, tab.name, ix.name, ic.key_ordinal, ic.index_column_id;
    """
    return fetch_df(conn, sql)


def get_row_counts(conn: pyodbc.Connection) -> pd.DataFrame:
    sql = """
    SELECT
        s.name AS schema_name,
        t.name AS table_name,
        SUM(p.rows) AS row_count
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
    GROUP BY s.name, t.name
    ORDER BY s.name, t.name;
    """
    df = fetch_df(conn, sql)
    if TABLES_INCLUDE:
        allowed = set(TABLES_INCLUDE)
        df = df[df.apply(lambda r: f"{r['schema_name']}.{r['table_name']}" in allowed, axis=1)]
    if TABLES_EXCLUDE:
        df = df[~df["table_name"].isin(TABLES_EXCLUDE)]
    return df.reset_index(drop=True)


def get_views(conn: pyodbc.Connection) -> tuple[pd.DataFrame, list[SqlObject]]:
    sql = """
    SELECT
        s.name AS schema_name,
        v.name AS object_name,
        'VIEW' AS object_type,
        m.definition,
        v.create_date,
        v.modify_date
    FROM sys.views v
    JOIN sys.schemas s ON s.schema_id = v.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id = v.object_id
    ORDER BY s.name, v.name;
    """
    df = fetch_df(conn, sql)
    objects = [SqlObject(r.schema_name, r.object_name, r.object_type, r.definition) for r in df.itertuples(index=False)]
    return df, objects


def get_procedures(conn: pyodbc.Connection) -> tuple[pd.DataFrame, list[SqlObject]]:
    sql = """
    SELECT
        s.name AS schema_name,
        p.name AS object_name,
        'PROCEDURE' AS object_type,
        m.definition,
        p.create_date,
        p.modify_date
    FROM sys.procedures p
    JOIN sys.schemas s ON s.schema_id = p.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id = p.object_id
    ORDER BY s.name, p.name;
    """
    df = fetch_df(conn, sql)
    objects = [SqlObject(r.schema_name, r.object_name, r.object_type, r.definition) for r in df.itertuples(index=False)]
    return df, objects


def get_functions(conn: pyodbc.Connection) -> tuple[pd.DataFrame, list[SqlObject]]:
    sql = """
    SELECT
        s.name AS schema_name,
        o.name AS object_name,
        o.type_desc AS object_type,
        m.definition,
        o.create_date,
        o.modify_date
    FROM sys.objects o
    JOIN sys.schemas s ON s.schema_id = o.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
    WHERE o.type IN ('FN', 'IF', 'TF', 'FS', 'FT')
    ORDER BY s.name, o.name;
    """
    df = fetch_df(conn, sql)
    objects = [SqlObject(r.schema_name, r.object_name, r.object_type, r.definition) for r in df.itertuples(index=False)]
    return df, objects


def get_triggers(conn: pyodbc.Connection) -> tuple[pd.DataFrame, list[SqlObject]]:
    sql = """
    SELECT
        s.name AS schema_name,
        tr.name AS object_name,
        'TRIGGER' AS object_type,
        m.definition,
        tr.create_date,
        tr.modify_date,
        OBJECT_NAME(tr.parent_id) AS parent_object_name,
        CASE WHEN tr.parent_class_desc = 'OBJECT_OR_COLUMN' THEN 'TABLE_OR_VIEW' ELSE tr.parent_class_desc END AS parent_class_desc,
        tr.is_disabled,
        tr.is_instead_of_trigger
    FROM sys.triggers tr
    LEFT JOIN sys.objects o ON o.object_id = tr.object_id
    LEFT JOIN sys.schemas s ON s.schema_id = o.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id = tr.object_id
    ORDER BY s.name, tr.name;
    """
    df = fetch_df(conn, sql)
    df["schema_name"] = df["schema_name"].fillna("dbo")
    objects = [SqlObject(r.schema_name, r.object_name, r.object_type, r.definition) for r in df.itertuples(index=False)]
    return df, objects


def save_object_definitions(objects: list[SqlObject], output_dir: Path) -> None:
    base = output_dir / "object_definitions"
    for obj in objects:
        if not obj.definition:
            continue
        folder = base / safe_name(obj.object_type.lower())
        filename = f"{safe_name(obj.schema_name)}.{safe_name(obj.object_name)}.sql"
        header = f"-- {obj.object_type}: {obj.fq_name}\n-- Exportado: {datetime.now().isoformat()}\n\n"
        write_text(folder / filename, header + obj.definition)


def quote_ident(name: str) -> str:
    return f"[{name.replace(']', ']]')}]"


def fq_table(schema_name: str, table_name: str) -> str:
    return f"{quote_ident(schema_name)}.{quote_ident(table_name)}"


def profile_tables(conn: pyodbc.Connection, columns_df: pd.DataFrame, tables_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    null_rows: list[dict] = []
    sample_rows: list[dict] = []

    if MAX_PROFILE_TABLES is not None:
        tables_df = tables_df.head(MAX_PROFILE_TABLES)

    # tipos que suelen dar problemas en DISTINCT/top muestra
    unsupported_for_samples = {"text", "ntext", "image", "xml", "sql_variant", "geography", "geometry", "hierarchyid"}

    for t in tables_df.itertuples(index=False):
        schema_name = t.schema_name
        table_name = t.table_name
        full_name = fq_table(schema_name, table_name)
        cols = columns_df[(columns_df["schema_name"] == schema_name) & (columns_df["table_name"] == table_name)]

        for c in cols.itertuples(index=False):
            col_name = c.column_name
            data_type = str(c.data_type).lower()
            col_ref = quote_ident(col_name)

            try:
                sql_nulls = f"""
                SELECT
                    COUNT_BIG(1) AS total_rows,
                    SUM(CASE WHEN {col_ref} IS NULL THEN 1 ELSE 0 END) AS null_rows,
                    COUNT_BIG(DISTINCT CASE WHEN {col_ref} IS NOT NULL THEN CONVERT(NVARCHAR(4000), {col_ref}) END) AS distinct_non_null_values
                FROM {full_name};
                """
                cur = conn.cursor()
                cur.execute(sql_nulls)
                total_rows, null_rows_count, distinct_count = cur.fetchone()
                null_rows.append({
                    "schema_name": schema_name,
                    "table_name": table_name,
                    "column_name": col_name,
                    "data_type": data_type,
                    "total_rows": int(total_rows or 0),
                    "null_rows": int(null_rows_count or 0),
                    "null_pct": round((float(null_rows_count or 0) / float(total_rows)) * 100, 2) if total_rows else 0.0,
                    "distinct_non_null_values": int(distinct_count or 0),
                })
            except Exception as e:
                null_rows.append({
                    "schema_name": schema_name,
                    "table_name": table_name,
                    "column_name": col_name,
                    "data_type": data_type,
                    "total_rows": None,
                    "null_rows": None,
                    "null_pct": None,
                    "distinct_non_null_values": None,
                    "error": str(e),
                })

            if data_type in unsupported_for_samples:
                continue

            try:
                sql_samples = f"""
                SELECT TOP {int(SAMPLE_ROWS_PER_COLUMN)}
                    CONVERT(NVARCHAR(4000), {col_ref}) AS sample_value,
                    COUNT_BIG(1) AS frequency
                FROM {full_name}
                WHERE {col_ref} IS NOT NULL
                GROUP BY CONVERT(NVARCHAR(4000), {col_ref})
                ORDER BY COUNT_BIG(1) DESC, CONVERT(NVARCHAR(4000), {col_ref});
                """
                samples = fetch_df(conn, sql_samples)
                for row in samples.itertuples(index=False):
                    sample_rows.append({
                        "schema_name": schema_name,
                        "table_name": table_name,
                        "column_name": col_name,
                        "sample_value": row.sample_value,
                        "frequency": int(row.frequency),
                    })
            except Exception as e:
                sample_rows.append({
                    "schema_name": schema_name,
                    "table_name": table_name,
                    "column_name": col_name,
                    "sample_value": None,
                    "frequency": None,
                    "error": str(e),
                })

    return pd.DataFrame(null_rows), pd.DataFrame(sample_rows)


def build_relationships_df(fk_df: pd.DataFrame) -> pd.DataFrame:
    if fk_df.empty:
        return pd.DataFrame(columns=[
            "from_table", "from_column", "to_table", "to_column", "fk_name"
        ])
    out = fk_df.copy()
    out["from_table"] = out["parent_schema"] + "." + out["parent_table"]
    out["to_table"] = out["referenced_schema"] + "." + out["referenced_table"]
    out.rename(columns={
        "parent_column": "from_column",
        "referenced_column": "to_column",
    }, inplace=True)
    return out[["from_table", "from_column", "to_table", "to_column", "fk_name"]]


def build_summary(
    db_info: dict,
    schemas_df: pd.DataFrame,
    tables_df: pd.DataFrame,
    columns_df: pd.DataFrame,
    pk_df: pd.DataFrame,
    fk_df: pd.DataFrame,
    uq_df: pd.DataFrame,
    chk_df: pd.DataFrame,
    def_df: pd.DataFrame,
    idx_df: pd.DataFrame,
    views_df: pd.DataFrame,
    procs_df: pd.DataFrame,
    funcs_df: pd.DataFrame,
    triggers_df: pd.DataFrame,
    row_counts_df: pd.DataFrame,
) -> dict:
    return {
        "generated_at": datetime.now().isoformat(),
        "database_info": db_info,
        "counts": {
            "schemas": int(len(schemas_df)),
            "tables": int(len(tables_df)),
            "columns": int(len(columns_df)),
            "primary_key_rows": int(len(pk_df)),
            "foreign_key_rows": int(len(fk_df)),
            "unique_constraint_rows": int(len(uq_df)),
            "check_constraints": int(len(chk_df)),
            "defaults": int(len(def_df)),
            "index_rows": int(len(idx_df)),
            "views": int(len(views_df)),
            "procedures": int(len(procs_df)),
            "functions": int(len(funcs_df)),
            "triggers": int(len(triggers_df)),
        },
        "tables_top_by_rows": row_counts_df.sort_values("row_count", ascending=False).head(20).to_dict(orient="records") if not row_counts_df.empty else [],
    }


def main() -> int:
    try:
        ensure_dependencies()
        validate_config()
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        print("[1/6] Conectando a SQL Server...")
        conn = get_connection()
        print("Conexión exitosa.")

        print("[2/6] Leyendo metadatos principales...")
        db_info = get_database_info(conn)
        schemas_df = get_schemas(conn)
        tables_df = get_tables(conn)
        columns_df = get_columns(conn)
        pk_df = get_primary_keys(conn)
        fk_df = get_foreign_keys(conn)
        uq_df = get_unique_constraints(conn)
        chk_df = get_check_constraints(conn)
        def_df = get_defaults(conn)
        idx_df = get_indexes(conn)
        row_counts_df = get_row_counts(conn)

        print("[3/6] Leyendo objetos programables...")
        views_df, views_objs = get_views(conn)
        procs_df, proc_objs = get_procedures(conn)
        funcs_df, func_objs = get_functions(conn)
        triggers_df, trigger_objs = get_triggers(conn)

        print("[4/6] Guardando reportes...")
        write_json(OUTPUT_DIR / "database_info.json", db_info)
        df_to_csv(schemas_df, OUTPUT_DIR / "schemas.csv")
        df_to_csv(tables_df, OUTPUT_DIR / "tables.csv")
        df_to_csv(columns_df, OUTPUT_DIR / "columns.csv")
        df_to_csv(pk_df, OUTPUT_DIR / "primary_keys.csv")
        df_to_csv(fk_df, OUTPUT_DIR / "foreign_keys.csv")
        df_to_csv(uq_df, OUTPUT_DIR / "unique_constraints.csv")
        df_to_csv(chk_df, OUTPUT_DIR / "check_constraints.csv")
        df_to_csv(def_df, OUTPUT_DIR / "defaults.csv")
        df_to_csv(idx_df, OUTPUT_DIR / "indexes.csv")
        df_to_csv(views_df, OUTPUT_DIR / "views.csv")
        df_to_csv(procs_df, OUTPUT_DIR / "procedures.csv")
        df_to_csv(funcs_df, OUTPUT_DIR / "functions.csv")
        df_to_csv(triggers_df, OUTPUT_DIR / "triggers.csv")
        df_to_csv(row_counts_df, OUTPUT_DIR / "table_row_counts.csv")
        df_to_csv(build_relationships_df(fk_df), OUTPUT_DIR / "relationships.csv")

        if SAVE_OBJECT_DEFINITIONS:
            save_object_definitions(views_objs + proc_objs + func_objs + trigger_objs, OUTPUT_DIR)

        if PROFILE_DATA:
            print("[5/6] Haciendo perfil básico de datos (puede tardar)...")
            profile_nulls_df, sample_values_df = profile_tables(conn, columns_df, tables_df)
            df_to_csv(profile_nulls_df, OUTPUT_DIR / "profile_nulls.csv")
            df_to_csv(sample_values_df, OUTPUT_DIR / "sample_values.csv")
        else:
            profile_nulls_df = pd.DataFrame()
            sample_values_df = pd.DataFrame()

        summary = build_summary(
            db_info, schemas_df, tables_df, columns_df, pk_df, fk_df,
            uq_df, chk_df, def_df, idx_df, views_df, procs_df,
            funcs_df, triggers_df, row_counts_df,
        )
        if PROFILE_DATA:
            summary["counts"]["profile_null_rows"] = int(len(profile_nulls_df))
            summary["counts"]["sample_value_rows"] = int(len(sample_values_df))

        write_json(OUTPUT_DIR / "summary.json", summary)

        print("[6/6] Listo.")
        print(f"Reporte generado en: {OUTPUT_DIR.resolve()}")
        print("Archivos clave:")
        print(f"- {OUTPUT_DIR / 'summary.json'}")
        print(f"- {OUTPUT_DIR / 'tables.csv'}")
        print(f"- {OUTPUT_DIR / 'columns.csv'}")
        print(f"- {OUTPUT_DIR / 'procedures.csv'}")
        print(f"- {OUTPUT_DIR / 'object_definitions'}")

        conn.close()
        return 0

    except Exception as e:
        err = {
            "generated_at": datetime.now().isoformat(),
            "error": str(e),
            "traceback": traceback.format_exc(),
            "available_odbc_drivers": list_sql_server_drivers(),
        }
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        write_json(OUTPUT_DIR / "error.json", err)
        print("Ocurrió un error.")
        print(str(e))
        print(f"Revisa: {(OUTPUT_DIR / 'error.json').resolve()}")
        return 1


if __name__ == "__main__":
    sys.exit(main())