require("../bootstrap");


// são paulo timezone


module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
    // freezeTableName: true
  },
  options: { requestTimeout: 600000, encrypt: true },
  retry: {
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 100
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 20,      // ✅ Aumentado para suportar prefetch(10)
    min: parseInt(process.env.DB_POOL_MIN) || 2,       // ✅ Reduzido de 15 para 2
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,  // ✅ Aumentado de 30s para 60s
    idle: parseInt(process.env.DB_POOL_IDLE) || 10000, // ✅ Reduzido de 10min para 10s
    evict: 5000  // ✅ Verificar conexões idle a cada 5s
  },
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: 'America/Sao_Paulo',
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false
};
