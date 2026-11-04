export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 413,
    readonly detail: string
  ) {
    super(detail);
    this.name = "HttpError";
  }
}

export function badRequest(detail: string): HttpError {
  return new HttpError(400, detail);
}

export function notFound(detail: string): HttpError {
  return new HttpError(404, detail);
}

export function payloadTooLarge(detail: string): HttpError {
  return new HttpError(413, detail);
}
