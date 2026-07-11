import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required.' });
    }

    // Official credentials for review authentication
    const testUser = 'reviewer_antigravity@domain.com';
    const testPass = 'MonsoonAlertSecurePass2026!';

    if (email === testUser && password === testPass) {
      // Sign JWT payload containing user email
      const token = fastify.jwt.sign({ email });
      return reply.send({ token });
    }

    return reply.code(401).send({ error: 'Invalid email or password.' });
  });
}
