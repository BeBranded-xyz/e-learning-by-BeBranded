// Values the integration global setup provides to every test file.
declare module "vitest" {
  // Declaration merging needs an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export {};
