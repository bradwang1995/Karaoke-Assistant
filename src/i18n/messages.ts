export type Translator = (key: string, values?: readonly (string | number)[]) => string;

export const interpolate: Translator = (template, values = []) =>
  template.replace(/\{(\d+)\}/g, (placeholder, index: string) => String(values[Number(index)] ?? placeholder));
