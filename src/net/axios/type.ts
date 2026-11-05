import type { AxiosResponse } from 'axios';

export interface ResponseTemplate<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export interface ResponseWrapper<T> {
  data: T;
  origin: AxiosResponse<ResponseTemplate<T>>;
}
