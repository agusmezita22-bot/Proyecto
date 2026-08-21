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

// Crear tabla automáticamente al iniciar el servidor
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
        console.log("Tabla 'leaderboard' verificada / creada con éxito.");
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err);
    }
};
initDb();

// Endpoint para guardar un nuevo puntaje
app.post('/api/score', async (req, res) => {
    const { playerName, score } = req.body;

    if (!playerName || score === undefined) {
        return res.status(400).json({ error: "Faltan datos requeridos (playerName o score)" });
    }

    try {
        await pool.query(
            'INSERT INTO leaderboard (player_name, score) VALUES ($1, $2)',
            [playerName, score]
        );
        res.status(200).json({ message: "Puntaje guardado exitosamente" });
    } catch (err) {
        console.error("Error al guardar el puntaje:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Endpoint para obtener los mejores puntajes según la pestaña
app.get('/api/leaderboard', async (req, res) => {
    const { tab } = req.query;
    let query = 'SELECT DISTINCT ON (player_name) player_name AS name, score FROM leaderboard ORDER BY player_name, score DESC';

    if (tab === 'sem') {
        query = `
            SELECT player_name AS name, MAX(score) AS score 
            FROM leaderboard 
            WHERE created_at >= NOW() - INTERVAL '7 days' 
            GROUP BY player_name 
            ORDER BY score DESC 
            LIMIT 10
        `;
    } else if (tab === 'mes') {
        query = `
            SELECT player_name AS name, MAX(score) AS score 
            FROM leaderboard 
            WHERE created_at >= NOW() - INTERVAL '30 days' 
            GROUP BY player_name 
            ORDER BY score DESC 
            LIMIT 10
        `;
    } else {
        // Para Provincia, Nacional e Internacional muestra el ranking histórico global
        query = `
            SELECT player_name AS name, MAX(score) AS score 
            FROM leaderboard 
            GROUP BY player_name 
            ORDER BY score DESC 
            LIMIT 10
        `;
    }

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al consultar la tabla de posiciones:", err);
        res.status(500).json({ error: "Error en la consulta de base de datos" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});
