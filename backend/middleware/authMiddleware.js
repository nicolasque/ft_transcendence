import jwtUtils from '../utils/jwtUtils.js';
import UserModel from '../models/Users.js';

/**
 * Middleware para verificar que el usuario esté autenticado
 * En Fastify, los preHandler NO usan next(), simplemente retornan o lanzan error
 */

async function authMiddleware(req, reply) {
    console.log('🔐 [AUTH MIDDLEWARE] Ejecutándose para:', req.method, req.url);
    
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ [AUTH MIDDLEWARE] Token no proporcionado');
            return reply.status(401).send({
                message: 'Token no proporcionado',
                error: 'Unauthorized'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwtUtils.verifyToken(token);

        if (!decoded) {
            console.log('❌ [AUTH MIDDLEWARE] Token inválido');
            return reply.status(401).send({
                message: 'Token inválido o expirado',
                error: 'Unauthorized'
            });
        }

        // Añadir usuario al request
        req.user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email
        };

        console.log('✅ [AUTH MIDDLEWARE] Usuario autenticado:', decoded.username);
        
        // ✅ En Fastify preHandler, simplemente NO retornar nada si todo está OK
        // NO llamar a next(), solo terminar la función
    } catch (error) {
        console.error('❌ [AUTH MIDDLEWARE] Error:', error);
        return reply.status(401).send({
            message: 'Error de autenticación',
            error: error.message
        });
    }
}

/**
 * Middleware opcional - no falla si no hay token
 */
async function optionalAuthMiddleware(req, reply) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwtUtils.verifyToken(token);

            if (decoded) {
                req.user = {
                    id: decoded.id,
                    username: decoded.username,
                    email: decoded.email
                };
            }
        }
        
        // ✅ En Fastify preHandler opcional, simplemente terminar sin error
    } catch (error) {
        // En modo opcional, continuar aunque haya error (no hacer nada)
    }
}

export { authMiddleware, optionalAuthMiddleware };
