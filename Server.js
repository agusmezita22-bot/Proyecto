const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Configuración amplia de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Conexión a la base de datos PostgreSQL de Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Inicialización automática de la tabla
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
        console.log("Tabla 'leaderboard' verificada y lista.");
    } catch (err) {
        console.error("Error al verificar la tabla:", err);
    }
};
initDb();

// Endpoint para recibir y guardar un puntaje
app.post('/api/score', async (req, res) => {
    const { playerName, score } = req.body;

    if (!playerName || score === undefined || score === null) {
        return res.status(400).json({ error: "Faltan datos obligatorios (playerName o score)" });
    }

    try {
        await pool.query(
            'INSERT INTO leaderboard (player_name, score) VALUES ($1, $2)',
            [playerName.trim(), parseInt(score, 10)]
        );
        res.status(200).json({ status: "success", message: "Puntaje guardado con éxito" });
    } catch (err) {
        console.error("Error al insertar puntaje:", err);
        res.status(500).json({ error: "Error en la base de datos" });
    }
});

// Endpoint para consultar el ranking
app.get('/api/leaderboard', async (req, res) => {
    const { tab } = req.query;

    let filter = "";
    if (tab === 'sem') {
        filter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    } else if (tab === 'mes') {
        filter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    }

    const query = `
        SELECT player_name AS name, MAX(score) AS score 
        FROM leaderboard 
        ${filter}
        GROUP BY player_name 
        ORDER BY score DESC 
        LIMIT 10
    `;

    try {
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error al consultar la lista:", err);
        res.status(500).json({ error: "Error al consultar la base de datos" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
