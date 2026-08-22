require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexión a la base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const SECRET_KEY = process.env.GAME_SECRET_KEY || 'SuperSecretPixelHopKey2026';

// CREACIÓN AUTOMÁTICA DE TABLAS AL ARRANCAR
async function initDB() {
    const queryText = `
        CREATE TABLE IF NOT EXISTS players (  
            id SERIAL PRIMARY KEY,  
            player_token VARCHAR(64) UNIQUE NOT NULL,  
            nickname VARCHAR(12) NOT NULL,  
            country VARCHAR(3) DEFAULT 'ARG',  
            province VARCHAR(64) DEFAULT 'Santa Fe',  
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  
        );  
        
        CREATE TABLE IF NOT EXISTS scores (  
            id SERIAL PRIMARY KEY,  
            player_id INT REFERENCES players(id) ON DELETE CASCADE,  
            score INT NOT NULL,  
            duration_seconds FLOAT NOT NULL,  
            pipes_passed INT NOT NULL,  
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  
        );  

        CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
        CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at);
        CREATE INDEX IF NOT EXISTS idx_players_country ON players(country);
        CREATE INDEX IF NOT EXISTS idx_players_province ON players(province);
    `;
    try {
        await pool.query(queryText);
        console.log("Tablas e índices SQL verificados/creados correctamente.");
    } catch (err) {
        console.error("Error inicializando la base de datos:", err);
    }
}
initDB();

// Limite de intentos de envio
const scoreSubmitLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo más tarde.' }
});

// Limpieza de apodo
const BAD_WORDS = ['admin', 'root', 'null', 'undefined', 'shit', 'fuck'];
function sanitizeNickname(nick) {
    let clean = (nick || 'Jugador').trim().replace(/[^a-zA-Z0-9_\-\.\s]/g, '');
    if (clean.length === 0) clean = 'Jugador';
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(word, 'gi');
        clean = clean.replace(regex, '***');
    });
    return clean.substring(0, 12);
}

// Endpoint de salud
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 1. Registro / Actualización de Jugador
app.post('/api/register', async (req, res) => {
    try {
        let { nickname, country, province, existingToken } = req.body;
        nickname = sanitizeNickname(nickname);
        country = (country || 'ARG').substring(0, 3).toUpperCase();
        province = (province || 'Santa Fe').substring(0, 64);

        if (existingToken) {
            const check = await pool.query('SELECT player_token FROM players WHERE player_token = $1', [existingToken]);
            if (check.rows.length > 0) {
                await pool.query(
                    'UPDATE players SET nickname = $1, country = $2, province = $3, updated_at = NOW() WHERE player_token = $4',
                    [nickname, country, province, existingToken]
                );
                return res.json({ token: existingToken, nickname, country, province });
            }
        }

        const newToken = crypto.randomBytes(32).toString('hex');
        await pool.query(
            'INSERT INTO players (player_token, nickname, country, province) VALUES ($1, $2, $3, $4)',
            [newToken, nickname, country, province]
        );
        res.json({ token: newToken, nickname, country, province });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor al registrar jugador.' });
    }
});

// 2. Envío de Puntuaciones
app.post('/api/scores', scoreSubmitLimiter, async (req, res) => {
    try {
        const { token, score, duration, pipesPassed, signature } = req.body;

        const payload = `${token}:${score}:${duration}:${pipesPassed}`;
        const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

        if (signature !== expectedSignature) {
            return res.status(403).json({ error: 'Firma de seguridad inválida.' });
        }

        if (score > 0) {
            const playerRes = await pool.query('SELECT id FROM players WHERE player_token = $1', [token]);
            if (playerRes.rows.length === 0) {
                return res.status(404).json({ error: 'Jugador no encontrado.' });
            }

            const playerId = playerRes.rows[0].id;
            await pool.query(
                'INSERT INTO scores (player_id, score, duration_seconds, pipes_passed) VALUES ($1, $2, $3, $4)',
                [playerId, score, duration || 10, pipesPassed || score]
            );
        }

        res.json({ success: true, message: 'Puntuación procesada exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al guardar la puntuación.' });
    }
});

// 3. Consulta de Leaderboard (Soporta todos los parámetros)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { timeframe, scope, tab, country, province } = req.query;
        const currentTab = tab || timeframe || scope || 'global';

        let dateFilter = '';
        if (currentTab === 'sem' || timeframe === 'sem') {
            dateFilter = "AND s.created_at >= NOW() - INTERVAL '7 days'";
        } else if (currentTab === 'mes' || timeframe === 'mes') {
            dateFilter = "AND s.created_at >= NOW() - INTERVAL '30 days'";
        }

        let geoFilter = '';
        const params = [];

        if ((currentTab === 'prov' || scope === 'prov') && province) {
            params.push(province);
            geoFilter = `AND p.province = $${params.length}`;
        } else if ((currentTab === 'nac' || scope === 'nac') && country) {
            params.push(country);
            geoFilter = `AND p.country = $${params.length}`;
        }

        const query = `
            SELECT p.nickname, p.country, p.province, MAX(s.score) as max_score
            FROM scores s
            JOIN players p ON s.player_id = p.id
            WHERE 1=1 ${dateFilter} ${geoFilter}
            GROUP BY p.id, p.nickname, p.country, p.province
            ORDER BY max_score DESC
            LIMIT 50;
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Error consultando leaderboard:", err);
        res.status(500).json([]);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Pixel-Hop escuchando en el puerto ${PORT}`);
});
