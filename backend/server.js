// Este es el corazón del backend. Crea una instancia del servidor Fastify, define las
// rutas (endpoints) que la API expondrá y pone el servidor a escuchar peticiones.
// Incluye la ruta raíz (/) para una respuesta básica, y la ruta /health que el
// healthcheck de Docker usará para verificar que el servicio está activo.

import Fastify from "fastify";
import db from "./db.js";
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import rutas from "./rutas.js";
import cors from '@fastify/cors';
import seedDatabase from "./utils/seedDatabase.js";
import { startActivityCheck, stopActivityCheck } from "./jobs/inactivityCheck.js"
import path from 'path';
import { fileURLToPath } from 'url';

// Crea una instancia de la aplicación Fastify. El objeto 'logger: true'
// // activará logs detallados en la consola, muy útil para depuración.
const fastify = Fastify({logger: true});

//Gestion de las fotos de los usaurios 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await fastify.register(multipart);


//Anado la el registro al plugin para las fotos de usuarios 
fastify.register(fastifyStatic, {
	root: path.join(__dirname, 'uploads'),
	prefix: '/uploads/',
});

fastify.get("/", async function name(req, res) {
  return ({hello : " world"})
});

rutas.forEach((ruta) => {
  fastify.route(ruta);
});

async function database() {
  try {
    await db.sync({}); // force: true borra y recrea las tablas en cada inicio
		console.log("Conectado a la base de datos");
	} catch (error)
	{
    console.log(error);
    throw error; // Propagar el error
	}
}


fastify.get('/health', { logLevel: 'silent' }, async (request, reply) => {
  // .code(200) establece explícitamente el código de estado HTTP.
  return reply.code(200).send({ status: 'ok' });
});

// En server.js
let activityCheckId;

// Arranque unificado asegurando host 0.0.0.0
async function start() {
  try {
    await database();
    await fastify.listen({
      port: Number(process.env.PORT),
      host: '0.0.0.0'
    });
    
    // Poblar base de datos con usuarios de prueba
    await seedDatabase();
    
    // Guardar el intervalId
    activityCheckId = startActivityCheck();
    
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
    console.log('🛑 Cerrando servidor...');
    stopActivityCheck(activityCheckId);

    await fastify.close();

    await db.close();

    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
}

// Escuchar señales de terminación
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start(); // ARancamos el servidor y la conexion con la base de datos
