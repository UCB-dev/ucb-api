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

app.get('/materias', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM materias');
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
  // Validar que se proporcione un correo
  const { email } = req.query;
  
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere un correo electrónico válido'
    });
  }

  const client = await pool.connect();
  try {
    // Usar parámetros preparados para prevenir inyección SQL
    const query = 'SELECT EXISTS(SELECT 1 FROM usuarios WHERE correo = $1) AS exists';
    const result = await client.query(query, [email]);
    
    // Devolver solo true o false sin exponer información adicional
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