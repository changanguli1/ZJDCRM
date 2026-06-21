type D1Parameter = unknown;

type SqlStatement = {
  sql: string;
  values?: readonly D1Parameter[];
};

export function statement(db: D1Database, sql: string, ...values: D1Parameter[]) {
  return db.prepare(sql).bind(...values);
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...values: D1Parameter[]
): Promise<T[]> {
  const result = await statement(db, sql, ...values).all<T>();
  return result.results;
}

export async function queryOne<T>(
  db: D1Database,
  sql: string,
  ...values: D1Parameter[]
): Promise<T | null> {
  return (await statement(db, sql, ...values).first<T>()) ?? null;
}

export async function execute(
  db: D1Database,
  sql: string,
  ...values: D1Parameter[]
) {
  return statement(db, sql, ...values).run();
}

export async function batch(db: D1Database, statements: readonly SqlStatement[]) {
  return db.batch(
    statements.map((sqlStatement) =>
      db.prepare(sqlStatement.sql).bind(...(sqlStatement.values ?? [])),
    ),
  );
}
