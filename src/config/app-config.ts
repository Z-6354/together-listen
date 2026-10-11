export interface AppConfig {
  port: number;
  environment: string;
}

export const appConfig: AppConfig = {
  port: Number(process.env.PORT ?? 3000),
  environment: process.env.NODE_ENV ?? "development"
};
