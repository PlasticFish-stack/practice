export interface MockRequest {
    url: string
    body?: unknown,
    query?: Record<string, string>
}

export interface MockType {
    url: string,
    method: string,
    response: (request?: MockRequest) => {
        code: number,
        data: {
            code: number,
            message: string,
            data: unknown
        }
    }
}