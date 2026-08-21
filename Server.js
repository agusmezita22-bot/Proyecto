const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crear la tabla automáticamente si no existe
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        name VARCHAR(12) NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Base de datos lista");
  } catch (err) {
    console.error("Error al iniciar DB:", err);
  }
};
initDb();

// 1. Guardar o actualizar puntaje
app.post('/api/score', async (req, res) => {
  const { name, score } = req.body;
  
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    const existing = await pool.query('SELECT * FROM leaderboard WHERE name = $1', [name]);

    if (existing.rows.length > 0) {
      if (score > existing.rows[0].score) {
        await pool.query('UPDATE leaderboard SET score = $1, created_at = NOW() WHERE name = $2', [score, name]);
      }
    } else {
      await pool.query('INSERT INTO leaderboard (name, score) VALUES ($1, $2)', [name, score]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// 2. Obtener el Top 50 según la pestaña solicitada
app.get('/api/leaderboard', async (req, res) => {
  const { tab } = req.query;
  let timeFilter = "";

  if (tab === 'sem') {
    timeFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
  } else if (tab === 'mes') {
    timeFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
  }

  try {
    const result = await pool.query(`
      SELECT name, score FROM leaderboard 
      ${timeFilter} 
      ORDER BY score DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
