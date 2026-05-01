// Plain value object passed between application service and provider adapter.
export interface Email {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}
