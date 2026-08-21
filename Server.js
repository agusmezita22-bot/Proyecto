const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a la base de datos de Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Crear tabla automáticamente al iniciar
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                score INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla 'leaderboard' lista.");
    } catch (err) {
        console.error("Error inicializando DB:", err);
    }
};
initDb();

// Guardar nuevo puntaje
app.post('/api/score', async (req, res) => {
    const { playerName, score } = req.body;

    if (!playerName || score === undefined) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    try {
        await pool.query(
            'INSERT INTO leaderboard (player_name, score) VALUES ($1, $2)',
            [playerName, Number(score)]
        );
        res.status(200).json({ message: "Guardado exitosamente" });
    } catch (err) {
        console.error("Error al guardar:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Obtener mejores puntajes por usuario
app.get('/api/leaderboard', async (req, res) => {
    const { tab } = req.query;
    
    let timeFilter = "";
    if (tab === 'sem') {
        timeFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    } else if (tab === 'mes') {
        timeFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    }

    const query = `
        SELECT player_name AS name, MAX(score) AS score 
        FROM leaderboard 
        ${timeFilter}
        GROUP BY player_name 
        ORDER BY score DESC 
        LIMIT 10
    `;

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al consultar ranking:", err);
        res.status(500).json({ error: "Error en la consulta" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
