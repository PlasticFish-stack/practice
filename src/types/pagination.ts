export interface Pagination<T> {
  list: T;
  page: number;
  pageSize: number;
  total: number;
}
