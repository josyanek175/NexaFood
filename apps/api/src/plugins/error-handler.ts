import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    const isProd = app.config.NODE_ENV === "production";

    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code }, error.message);
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
          requestId: request.id,
        },
      });
    }

    const statusCode =
      typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled error");
    } else {
      request.log.warn({ err: error }, "Request error");
    }

    const message =
      statusCode >= 500
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Request error";

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message,
        requestId: request.id,
        ...(!isProd && error instanceof Error ? { stack: error.stack } : {}),
      },
    });
  });
};

export default fp(errorHandlerPlugin, { name: "error-handler" });
