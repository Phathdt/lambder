export interface Clock {
  now(): Date;
  nowSeconds(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
