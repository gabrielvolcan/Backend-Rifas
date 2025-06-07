const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Para manejar JSON en el body

// Configuración de multer para subir archivos a /uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Asegúrate de que la carpeta 'uploads' exista
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Archivo JSON para guardar participaciones
const DATA_FILE = path.join(__dirname, 'data', 'participations.json');

// Función para leer participaciones
function readParticipations() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Si el archivo no existe, lo creamos con un array vacío
    if (err.code === 'ENOENT') {
      saveParticipations([]); // Crear el archivo si no existe
    }
    return []; // Si ocurre otro error, retornamos vacío
  }
}

// Función para guardar participaciones
function saveParticipations(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); // Guardar los datos
    console.log('Participaciones guardadas:', data); // Imprimir en consola
  } catch (err) {
    console.error("Error al guardar las participaciones:", err);
  }
}

// Función para generar un número de boleto aleatorio
function generarNumeroBoleto() {
  return Math.floor(Math.random() * 1000000); // Un número aleatorio de 6 dígitos
}

// Función para enviar el correo con el número de boleto
async function enviarCorreo(email, numeroBoleto) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Usamos Gmail como servicio
    auth: {
      user: 'gabrieldisena1@gmail.com', // Tu dirección de correo de Gmail
      pass: 'xfzx tzgo kkoi ryes' // La contraseña de aplicación generada
    }
  });

  const mailOptions = {
    from: 'gabrieldisena1@gmail.com', // Tu correo electrónico de Gmail
    to: email,  // El correo del participante
    subject: 'Confirmación de Participación en la Rifa',
    text: `¡Gracias por participar en la rifa! Tu número de boleto es: ${numeroBoleto}.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado con éxito');
  } catch (error) {
    console.error('Error al enviar el correo:', error);
  }
}

// Endpoint para recibir participación con multer (form-data)
app.post('/participation', upload.single('paymentProof'), (req, res) => {
  const { fullName, phone, email, country, raffle, boletos } = req.body;

  if (!fullName || !phone || !email || !country || !raffle || !boletos) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const boletosNum = Number(boletos);
  if (isNaN(boletosNum) || boletosNum <= 0) {
    return res.status(400).json({ error: 'El número de boletos debe ser un valor positivo' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'El comprobante es obligatorio' });
  }

  const participations = readParticipations();
  const numeroBoleto = generarNumeroBoleto(); // Generamos un número de boleto aleatorio

  const nuevaParticipacion = {
    id: Date.now().toString(),
    fullName,
    phone,
    email,
    country,
    rifa: raffle,
    boletos: boletosNum,
    estado: 'pendiente', // El estado se marca como 'pendiente'
    numeros_boletos: [],
    comprobante_url: req.file.filename,
    fecha: new Date().toISOString()
  };

  participations.push(nuevaParticipacion);
  saveParticipations(participations); // Guardamos las participaciones

  console.log('Nueva participación recibida:', nuevaParticipacion); // Imprimir participación agregada

  res.json({ message: 'Participación recibida, pendiente de confirmación', id: nuevaParticipacion.id });
});

// Endpoint para confirmar la participación manualmente
app.post('/participations/:id/confirm', (req, res) => {
  const { id } = req.params;
  const participations = readParticipations();
  const participation = participations.find(p => p.id === id);

  if (!participation) {
    return res.status(404).json({ error: 'Participación no encontrada' });
  }

  // Si la participación ya está confirmada, no hacer nada
  if (participation.estado === 'confirmado') {
    return res.status(400).json({ error: 'La participación ya ha sido confirmada' });
  }

  // Generamos el número de boleto
  const numeroBoleto = generarNumeroBoleto();
  participation.estado = 'confirmado';
  participation.numeros_boletos = [numeroBoleto];  // Asignamos el boleto

  saveParticipations(participations); // Guardamos la participación confirmada

  // Enviamos el correo al participante
  enviarCorreo(participation.email, numeroBoleto)
    .then(() => {
      console.log('Participación confirmada:', participation);
      res.json({ message: 'Participación confirmada y correo enviado', numeroBoleto });
    })
    .catch(error => res.status(500).json({ error: 'Hubo un error al enviar el correo' }));
});

// Asegúrate de que el servidor escuche correctamente
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});





