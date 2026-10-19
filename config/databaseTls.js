// Opt in using the database provider's certificate requirements. Never disable
// certificate verification. ANALYTICS_DB_SSL can override the application setting.
export function databaseTls(env = process.env, prefix = "DB") {
  const enabled = env[`${prefix}_SSL`] ?? env.DB_SSL;
  if (enabled !== "true") return undefined;
  const ca = env[`${prefix}_SSL_CA`] ?? env.DB_SSL_CA;
  return { rejectUnauthorized: true, ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}) };
}
