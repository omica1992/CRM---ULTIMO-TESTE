import cacheLayer from "../libs/cache";
import logger from "../utils/logger";

/**
 * Cria um lock distribuído usando Redis para evitar race conditions
 * @param key - Chave única para o lock
 * @param timeout - Tempo máximo de espera em ms (padrão: 5000ms)
 * @returns Função para liberar o lock
 */
export async function createLock(
    key: string,
    timeout: number = 5000
): Promise<() => Promise<void>> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    const maxRetries = Math.floor(timeout / 50);

    logger.info(`[LOCK] Tentando adquirir lock: ${lockKey}`);

    // Tentar adquirir lock
    let acquired = false;
    let retries = 0;

    while (!acquired && retries < maxRetries) {
        try {
            const existing = await cacheLayer.get(lockKey);

            if (!existing) {
                // Lock disponível - tentar adquirir
                await cacheLayer.set(lockKey, lockValue, "EX", Math.ceil(timeout / 1000));

                // Verificar se realmente adquirimos (double-check)
                const check = await cacheLayer.get(lockKey);
                if (check === lockValue) {
                    acquired = true;
                    logger.info(`[LOCK] ✅ Lock adquirido: ${lockKey} (tentativa ${retries + 1})`);
                }
            }

            if (!acquired) {
                // Aguardar antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 50));
                retries++;
            }
        } catch (error) {
            logger.error(`[LOCK] Erro ao tentar adquirir lock ${lockKey}:`, error);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    if (!acquired) {
        logger.error(`[LOCK] ❌ Falha ao adquirir lock após ${retries} tentativas: ${lockKey}`);
        throw new Error(`Failed to acquire lock: ${key} (timeout after ${timeout}ms)`);
    }

    // Retornar função para liberar lock
    return async () => {
        try {
            const current = await cacheLayer.get(lockKey);
            if (current === lockValue) {
                await cacheLayer.del(lockKey);
                logger.info(`[LOCK] 🔓 Lock liberado: ${lockKey}`);
            } else {
                logger.warn(`[LOCK] ⚠️ Lock já foi liberado ou expirou: ${lockKey}`);
            }
        } catch (error) {
            logger.error(`[LOCK] Erro ao liberar lock ${lockKey}:`, error);
        }
    };
}

/**
 * Executa uma função com lock automático
 * @param key - Chave única para o lock
 * @param fn - Função a ser executada com lock
 * @param timeout - Tempo máximo de espera em ms
 */
export async function withLock<T>(
    key: string,
    fn: () => Promise<T>,
    timeout: number = 5000
): Promise<T> {
    const release = await createLock(key, timeout);

    try {
        return await fn();
    } finally {
        await release();
    }
}
