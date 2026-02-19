declare module "bcryptjs" {
  export function genSaltSync(rounds?: number): string;
  export function hashSync(s: string, saltOrRounds?: string | number): string;
  export function compareSync(s: string, hash: string): boolean;

  export function genSalt(rounds?: number): Promise<string>;
  export function hash(s: string, saltOrRounds?: string | number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
}
