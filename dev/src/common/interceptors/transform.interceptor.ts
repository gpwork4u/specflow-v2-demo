import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 針對非分頁的回應，直接透傳 controller 回傳的資料。
 * 分頁回應由各 controller 自行組合 { data, meta } 格式。
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // 如果 controller 已設定特殊 status code (如 204)，不做處理
        const response = context.switchToHttp().getResponse();
        if (response.statusCode === 204) {
          return;
        }
        return data;
      }),
    );
  }
}
