import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER, 
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: {
    required: true,
    rejectUnauthorized: false,
  }
});

const app = express();
const port = process.env.PORT || 5001;


const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 solicitudes por ventana de IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, por favor intente más tarde'
  }
});

app.use(express.json());
app.use(apiLimiter);
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/users', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM usuarios');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});

app.patch('/saber/:id/completado', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { completado } = req.body;
    
    const result = await client.query(
      'UPDATE saberes_minimos SET completado = $1 WHERE id = $2 RETURNING *',
      [completado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Saber no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Estado actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar el saber:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el saber',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.get('/recuperatorios', async (req, res) => {

  const client = await pool.connect();
  const { elemento} = req.query;
  try {
    const query = 'SELECT r.* FROM recuperatorios r JOIN elementos_competencia e ON r.elemento_competencia_id = e.id WHERE e.id = $1';
    const result = await client.query(query, [elemento]);
    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});

app.get('/saberes', async (req, res) => {

  const client = await pool.connect();
  const { elemento} = req.query;
  try {
    const query = 'SELECT s.* FROM saberes_minimos s JOIN elementos_competencia e ON s.elemento_competencia_id = e.id WHERE e.id = $1';
    const result = await client.query(query, [elemento]);
    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});

app.get('/users', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM usuarios');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});
app.get('/elementos', async (req, res) => {

  const client = await pool.connect();
  const { materia} = req.query;
  try {
    const query = 'SELECT e.* FROM elementos_competencia e JOIN materias m ON e.materia_id = m.id WHERE m.id = $1 ORDER BY e.descripcion';
    const result = await client.query(query, [materia]);
    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});

app.get('/materias', async (req, res) => {

  const client = await pool.connect();
  const { email} = req.query;
  try {
    const query = 'SELECT m.* FROM materias m JOIN usuarios u ON m.docente_id = u.id WHERE u.correo = $1';
    const result = await client.query(query, [email]);
    res.json({
      data: result.rows
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con la base de datos',
      error: error.message
    });
  } finally {
    client.release(); 
  }
});

app.get('/validate-email', async (req, res) => {
  const { email } = req.query;
  
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un correo electrónico válido'
    });
  }

  const client = await pool.connect();
  try {

    const query = 'SELECT EXISTS(SELECT 1 FROM usuarios WHERE correo = $1) AS exists';
    const result = await client.query(query, [email]);
    res.json({
      exists: result.rows[0].exists
    });
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);



function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});