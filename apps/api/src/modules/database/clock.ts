import { Injectable } from '@nestjs/common';

// The current time. Tests replace it to check deadlines (brief F-002).
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
