import { randomUUID } from 'crypto';
// UUID 生成
export function generateSessionId() {
    return randomUUID();
}
