const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de CORS para permitir conexiones desde tu web de GitHub Pages
app.use(cors());
app.use(express.json());

// Conexión con la base de datos PostgreSQL de Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear la tabla si no existe al iniciar
pool.query(`
  CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Error al crear tabla:', err));

// RUTA 1: Guardar puntaje (POST /score)
app.post('/score', async (req, res) => {
  const { name, score } = req.body;
  if (!name || score === undefined) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    await pool.query('INSERT INTO scores (name, score) VALUES ($1, $2)', [name, score]);
    res.status(200).json({ success: true, message: 'Puntaje guardado' });
  } catch (err) {
    console.error('Error al insertar puntaje:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// RUTA 2: Obtener tabla de posiciones (GET /leaderboard)
app.get('/leaderboard', async (req, res) => {
  try {
    // Retorna los 10 puntajes más altos registrados
    const result = await pool.query(
      'SELECT name, MAX(score) as score FROM scores GROUP BY name ORDER BY score DESC LIMIT 10'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al obtener ranking:', err);
    res.status(500).json({ error: 'Error al consultar base de datos' });
  }
});

// Ruta raíz de prueba
app.get('/', (req, res) => {
  res.send('Servidor Pixel-Hop activo');
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
