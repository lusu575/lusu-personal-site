export function costGuardTestConfig(): Record<string, string>;
export function seedCostGuardTestBudget(DB: { prepare(sql: string): any }): Promise<void>;
