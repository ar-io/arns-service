import winston, { format, transports } from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const LOG_FORMAT = process.env.LOG_FORMAT ?? "json";

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format((info) => {
      // Only log stack traces when the log level is error
      if (info.stack && info.level !== "error") {
        delete info.stack;
      }
      return info;
    })(),
    format.errors(),
    format.timestamp(),
    LOG_FORMAT === "json" ? format.json() : format.simple()
  ),
  transports: new transports.Console(),
});

export default logger;
