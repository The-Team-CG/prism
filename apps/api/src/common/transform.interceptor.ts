import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, { data: T } | StreamableFile>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ data: T } | StreamableFile> {
    return next.handle().pipe(map((data) => data instanceof StreamableFile ? data : ({ data })));
  }
}
