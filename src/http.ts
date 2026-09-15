import type { Context } from "hono"

export type ErrorCode =
    | "BAD_REQUEST"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INTERNAL_ERROR"

export const errorResponse = (
    c: Context,
    status: 400 | 404 | 409 | 500,
    code: ErrorCode,
    message: string,
    details?: unknown
) => c.json({
    ok: false,
    error: {
        code,
        message,
        ...(details === undefined ? {} : { details })
    }
}, status)

export const successResponse = <T>(c: Context, data: T, status: 200 | 201 = 200) =>
    c.json({ ok: true, data }, status)

export const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0

export const parseJson = async <T>(c: Context): Promise<T | null> => {
    try {
        return await c.req.json<T>()
    } catch {
        return null
    }
}
