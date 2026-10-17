import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// Each argon2 run uses about 19 MB of RAM. One provider runs them all, so a test can count them (brief F-006).
@Injectable()
export class Passwords {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
