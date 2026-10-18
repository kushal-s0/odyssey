export function developmentApiTarget(
  environment: Record<string, string | undefined>,
) {
  const port = Number(environment.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535.");
  return `http://127.0.0.1:${port}`;
}
