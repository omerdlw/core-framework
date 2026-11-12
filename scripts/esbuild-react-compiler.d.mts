import type { Plugin } from "esbuild";

export interface CompilerEvent {
  filename: string;
  kind: string;
  reason?: string;
}

export interface ReactCompilerOptions {
  include: RegExp;
  report: (event: CompilerEvent) => void;
}

export function reactCompiler(options: ReactCompilerOptions): Plugin;
