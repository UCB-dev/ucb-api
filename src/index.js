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
  windowMs: 15 * 60 * 1000, 
  max: 100, 
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
app.delete('/recuperatorio/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de recuperatorio inválido'
      });
    }
    

    const checkQuery = 'SELECT id FROM recuperatorios WHERE id = $1';
    const checkResult = await client.query(checkQuery, [parseInt(id)]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recuperatorio no encontrado'
      });
    }
    
    const deleteQuery = 'DELETE FROM recuperatorios WHERE id = $1 RETURNING *';
    const deleteResult = await client.query(deleteQuery, [parseInt(id)]);
    
    res.json({
      success: true,
      message: 'Recuperatorio eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar recuperatorio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar recuperatorio',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.post('/recuperatorio', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { completado, elemento_competencia_id, fecha_evaluado } = req.body;
    
    if (elemento_competencia_id === undefined || completado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Los campos elemento_competencia_id y completado son requeridos'
      });
    }
    
    const query = `
      INSERT INTO recuperatorios (completado, elemento_competencia_id, fecha_evaluado) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    
    const values = [
      completado,
      elemento_competencia_id,
      fecha_evaluado || null 
    ];
    
    const result = await client.query(query, values);
    
    res.status(201).json({
      success: true,
      message: 'Recuperatorio creado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear recuperatorio:', error);
    
    if (error.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'El elemento_competencia_id especificado no existe'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error al crear recuperatorio',
        error: error.message
      });
    }
  } finally {
    client.release();
  }
});

app.patch('/materia/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rec_tomados, elem_completados, elem_evaluados, vigente } = req.body;
    
    if (rec_tomados === undefined && elem_completados === undefined && 
        elem_evaluados === undefined && vigente === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar (rec_tomados, elem_completados, elem_evaluados, vigente)'
      });
    }

    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    if (rec_tomados !== undefined) {
      updateFields.push(`rec_tomados = $${paramIndex}`);
      values.push(rec_tomados);
      paramIndex++;
    }

    if (elem_completados !== undefined) {
      updateFields.push(`elem_completados = $${paramIndex}`);
      values.push(elem_completados);
      paramIndex++;
    }

    if (elem_evaluados !== undefined) {
      updateFields.push(`elem_evaluados = $${paramIndex}`);
      values.push(elem_evaluados);
      paramIndex++;
    }

    if (vigente !== undefined) {
      updateFields.push(`vigente = $${paramIndex}`);
      values.push(vigente);
      paramIndex++;
    }

    values.push(id); 

    const query = `UPDATE materias SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Materia no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Materia actualizada correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar la materia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la materia',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.patch('/elemento/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { evaluado, comentario, fecha_registro, fecha_evaluado, saberes_completados, completado } = req.body;
    
    if (evaluado === undefined && comentario === undefined && fecha_registro === undefined && 
        saberes_completados === undefined && completado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar (evaluado, comentario, fecha_registro, saberes_completados, completado)'
      });
    }

    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    if (evaluado !== undefined) {
      updateFields.push(`evaluado = $${paramIndex}`);
      values.push(evaluado);
      paramIndex++;
    }

    if (comentario !== undefined) {
      updateFields.push(`comentario = $${paramIndex}`);
      values.push(comentario);
      paramIndex++;
    }

    if (fecha_registro !== undefined) {
      updateFields.push(`fecha_registro = $${paramIndex}`);
      values.push(fecha_registro);
      paramIndex++;
    }
    if (fecha_evaluado !== undefined) {
      updateFields.push(`fecha_evaluado = $${paramIndex}`);
      values.push(fecha_evaluado);
      paramIndex++;
    }

    if (saberes_completados !== undefined) {
      updateFields.push(`saberes_completados = $${paramIndex}`);
      values.push(saberes_completados);
      paramIndex++;
    }

    if (completado !== undefined) {
      updateFields.push(`completado = $${paramIndex}`);
      values.push(completado);
      paramIndex++;
    }

    values.push(id);

    const query = `UPDATE elementos_competencia SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Elemento no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Elemento actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar el elemento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el elemento',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.patch('/recuperatorio/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { completado, fecha_evaluado } = req.body;
    
    if (completado === undefined && fecha_evaluado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar (completado, fecha_evaluado)'
      });
    }

    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    if (completado !== undefined) {
      updateFields.push(`completado = $${paramIndex}`);
      values.push(completado);
      paramIndex++;
    }

    if (fecha_evaluado !== undefined) {
      updateFields.push(`fecha_evaluado = $${paramIndex}`);
      values.push(fecha_evaluado);
      paramIndex++;
    }

    values.push(id); 

    const query = `UPDATE recuperatorios SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recuperatorio no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Recuperatorio actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar el recuperatorio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el recuperatorio',
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