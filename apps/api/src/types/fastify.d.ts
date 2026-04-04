import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
    };
    payload: {
      sub: string;
      email: string;
    };
  }
}
