export interface ResponseTemplate<T = unknown> {
  code: number
  data: T
  message: string
}